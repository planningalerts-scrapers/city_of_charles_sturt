// Parses the development application at the South Australian City of Charles Sturt web site and
// places them in a database.
//
// Michael Bone
// 16th August 2018
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const cheerio = require("cheerio");
const request = require("request-promise-native");
const sqlite3 = require("sqlite3");
const moment = require("moment");
sqlite3.verbose();
const DevelopmentApplicationsUrl = "https://eproperty.charlessturt.sa.gov.au/eProperty/P1/eTrack/eTrackApplicationSearchResults.aspx?Field=S&Period=L28&r=P1.WEBGUEST&f=%24P1.ETR.SEARCH.SL28";
const DevelopmentApplicationUrl = "https://eproperty.charlessturt.sa.gov.au/eProperty/P1/eTrack/eTrackApplicationDetails.aspx?r=P1.WEBGUEST&f=%24P1.ETR.APPDET.VIW&ApplicationId={0}";
const CommentUrl = "mailto:council@charlessturt.sa.gov.au ";
// Sets up an sqlite database.
async function initializeDatabase() {
    return new Promise((resolve, reject) => {
        let database = new sqlite3.Database("data.sqlite");
        database.serialize(() => {
            database.run("create table if not exists [data] ([council_reference] text primary key, [address] text, [description] text, [info_url] text, [comment_url] text, [date_scraped] text, [date_received] text, [on_notice_from] text, [on_notice_to] text)");
            resolve(database);
        });
    });
}
// Inserts a row in the database if it does not already exist.
async function insertRow(database, developmentApplication) {
    return new Promise((resolve, reject) => {
        let sqlStatement = database.prepare("insert or ignore into [data] values (?, ?, ?, ?, ?, ?, ?, ?, ?)");
        sqlStatement.run([
            developmentApplication.applicationNumber,
            developmentApplication.address,
            developmentApplication.description,
            developmentApplication.informationUrl,
            developmentApplication.commentUrl,
            developmentApplication.scrapeDate,
            null,
            null,
            developmentApplication.onNoticeToDate
        ], function (error, row) {
            if (error) {
                console.log(error);
                reject(error);
            }
            else {
                if (this.changes > 0)
                    console.log(`    Inserted: application \"${developmentApplication.applicationNumber}\" with address \"${developmentApplication.address}\" and description \"${developmentApplication.description}\" into the database.`);
                else
                    console.log(`    Skipped: application \"${developmentApplication.applicationNumber}\" with address \"${developmentApplication.address}\" and description \"${developmentApplication.description}\" because it was already present in the database.`);
                sqlStatement.finalize(); // releases any locks
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
        console.log(`There is ${pageCount} page to parse.`);
    else
        console.log(`There are at least ${pageCount} pages to parse.`);
    // Process the text from each page.
    for (let pageIndex = 1; pageIndex <= 50; pageIndex++) { // as a safety precaution enforce a hard limit of 50 pages
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
                    }
                });
                $ = cheerio.load(body);
                eventValidation = $("input[name='__EVENTVALIDATION']").val();
                viewState = $("input[name='__VIEWSTATE']").val();
            }
            catch (ex) {
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
            let receivedDate = moment(row[1], "D/MM/YYYY", true); // allows the leading zero of the day to be omitted
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2NyYXBlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInNjcmFwZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsZ0dBQWdHO0FBQ2hHLDZCQUE2QjtBQUM3QixFQUFFO0FBQ0YsZUFBZTtBQUNmLG1CQUFtQjtBQUVuQixZQUFZLENBQUM7O0FBRWIsbUNBQW1DO0FBQ25DLGtEQUFrRDtBQUNsRCxtQ0FBbUM7QUFDbkMsaUNBQWlDO0FBRWpDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsQ0FBQztBQUVsQixNQUFNLDBCQUEwQixHQUFHLDJKQUEySixDQUFDO0FBQy9MLE1BQU0seUJBQXlCLEdBQUcsbUpBQW1KLENBQUM7QUFDdEwsTUFBTSxVQUFVLEdBQUcsd0NBQXdDLENBQUM7QUFFNUQsOEJBQThCO0FBRTlCLEtBQUssVUFBVSxrQkFBa0I7SUFDN0IsT0FBTyxJQUFJLE9BQU8sQ0FBQyxDQUFDLE9BQU8sRUFBRSxNQUFNLEVBQUUsRUFBRTtRQUNuQyxJQUFJLFFBQVEsR0FBRyxJQUFJLE9BQU8sQ0FBQyxRQUFRLENBQUMsYUFBYSxDQUFDLENBQUM7UUFDbkQsUUFBUSxDQUFDLFNBQVMsQ0FBQyxHQUFHLEVBQUU7WUFDcEIsUUFBUSxDQUFDLEdBQUcsQ0FBQywwT0FBME8sQ0FBQyxDQUFDO1lBQ3pQLE9BQU8sQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUN0QixDQUFDLENBQUMsQ0FBQztJQUNQLENBQUMsQ0FBQyxDQUFDO0FBQ1AsQ0FBQztBQUVELDhEQUE4RDtBQUU5RCxLQUFLLFVBQVUsU0FBUyxDQUFDLFFBQVEsRUFBRSxzQkFBc0I7SUFDckQsT0FBTyxJQUFJLE9BQU8sQ0FBQyxDQUFDLE9BQU8sRUFBRSxNQUFNLEVBQUUsRUFBRTtRQUNuQyxJQUFJLFlBQVksR0FBRyxRQUFRLENBQUMsT0FBTyxDQUFDLGlFQUFpRSxDQUFDLENBQUM7UUFDdkcsWUFBWSxDQUFDLEdBQUcsQ0FBQztZQUNiLHNCQUFzQixDQUFDLGlCQUFpQjtZQUN4QyxzQkFB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