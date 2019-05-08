// Parses the development application at the South Australian City of Charles Sturt web site and
// places them in a database.
//
// Michael Bone
// 16th August 2018

"use strict";

import * as cheerio from "cheerio";
import * as request from "request-promise-native";
import * as sqlite3 from "sqlite3";
import * as moment from "moment";

sqlite3.verbose();

const DevelopmentApplicationsUrl = "https://eproperty.charlessturt.sa.gov.au/eProperty/P1/eTrack/eTrackApplicationSearchResults.aspx?Field=S&Period=L28&r=P1.WEBGUEST&f=%24P1.ETR.SEARCH.SL28";
const DevelopmentApplicationUrl = "https://eproperty.charlessturt.sa.gov.au/eProperty/P1/eTrack/eTrackApplicationDetails.aspx?r=P1.WEBGUEST&f=%24P1.ETR.APPDET.VIW&ApplicationId={0}";
const CommentUrl = "mailto:council@charlessturt.sa.gov.au ";

// Sets up an sqlite database.

async function initializeDatabase() {
    return new Promise((resolve, reject) => {
        let database = new sqlite3.Database("data.sqlite");
        database.serialize(() => {
            database.run("create table if not exists [data] ([council_reference] text primary key, [description] text, [on_notice_to] text, [address] text, [info_url] text, [comment_url] text, [date_scraped] text)");
            resolve(database);
        });
    });
}

// Inserts a row in the database if it does not already exist.

async function insertRow(database, developmentApplication) {
    return new Promise((resolve, reject) => {
        let sqlStatement = database.prepare("insert or replace into [data] values (?, ?, ?, ?, ?, ?, ?)");
        sqlStatement.run([
            developmentApplication.applicationNumber,
            developmentApplication.description,
            developmentApplication.onNoticeToDate,
            developmentApplication.address,
            developmentApplication.informationUrl,
            developmentApplication.commentUrl,
            developmentApplication.scrapeDate
        ], function(error, row) {
            if (error) {
                console.log(error);
                reject(error);
            }
            else {
                console.log(`    Saved: application \"${developmentApplication.applicationNumber}\" with address \"${developmentApplication.address}\" and description \"${developmentApplication.description}\" into the database.`);
                sqlStatement.finalize();  // releases any locks
                resolve(row);
            }
        });
    });
}

// Parses the page at the specified URL.

async function main() {
    // Ensure that the database exists.

    let database = await initializeDatabase();

    // Retrieve the main page.

    console.log(`Retrieving page: ${DevelopmentApplicationsUrl}`);
    let body = await request({ url: DevelopmentApplicationsUrl });
    let $ = cheerio.load(body);

    // Examine the HTML to determine how many pages need to be retrieved.

    let pageCount = Math.max(1, $("tr.pagerRow td").length - 1);
    let eventValidation = $("input[name='__EVENTVALIDATION']").val();
    let viewState = $("input[name='__VIEWSTATE']").val();

    if (pageCount === 1)
        console.log(`There is ${pageCount} page to parse.`)
    else
        console.log(`There are at least ${pageCount} pages to parse.`)

    // Process the text from each page.

    for (let pageIndex = 1; pageIndex <= 50; pageIndex++) {  // as a safety precaution enforce a hard limit of 50 pages
        console.log(`Parsing page ${pageIndex}.`);

        // Retrieve a subsequent page.

        if (pageIndex >= 2) {
            try {
                let body = await request.post({
                    url: DevelopmentApplicationsUrl,
                    headers: { "Content-Type": "application/x-www-form-urlencoded" },
                    form: {
                        __EVENTARGUMENT: `Page$${pageIndex}`,
                        __EVENTTARGET: "ctl00$Content$cusResultsGrid$repWebGrid$ctl00$grdWebGridTabularView",
                        __EVENTVALIDATION: eventValidation,
                        __VIEWSTATE: viewState
                }});
                $ = cheerio.load(body);
                eventValidation = $("input[name='__EVENTVALIDATION']").val();
                viewState = $("input[name='__VIEWSTATE']").val();
            } catch (ex) {
                console.log(`Reached the last page: ${ex.message}`);
                break;
            }
        }

        // Use cheerio to find all development applications listed in the current page.

        for (let element of $("table.grid tr.normalRow, table.grid tr.alternateRow").get()) {
            let row = $(element).children("td").get().map(cell => $(cell).text().trim());
            if (row.length < 4)
                continue;

            let applicationNumber = row[0];
            let receivedDate = moment(row[1], "D/MM/YYYY", true);  // allows the leading zero of the day to be omitted
            let description = row[2];
            let address = row[3];

            // Check for a valid application number and a non-empty address.

            if (!/^[0-9]{3}\/[0-9]{1,5}\/[0-9]{2}$/.test(applicationNumber) || address === "")
                continue;
    
            await insertRow(database, {
                applicationNumber: applicationNumber,
                address: address,
                description: ((description === "") ? "No description provided" : description),
                informationUrl: DevelopmentApplicationUrl.replace(/\{0\}/g, applicationNumber),
                commentUrl: CommentUrl,
                scrapeDate: moment().format("YYYY-MM-DD"),
                receivedDate: receivedDate.isValid ? receivedDate.format("YYYY-MM-DD") : ""
            });
        }
    }
}

main().then(() => console.log("Complete.")).catch(error => console.error(error));
