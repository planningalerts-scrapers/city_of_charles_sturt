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
            database.run("create table if not exists [data] ([council_reference] text primary key, [description] text, [on_notice_to] text, [address] text, [info_url] text, [comment_url] text, [date_scraped] text)");
            resolve(database);
        });
    });
}
// Inserts a row in the database if it does not already exist.
async function insertRow(database, developmentApplication) {
    return new Promise((resolve, reject) => {
        let sqlStatement = database.prepare("insert or ignore into [data] values (?, ?, ?, ?, ?, ?, ?)");
        sqlStatement.run([
            developmentApplication.applicationNumber,
            developmentApplication.description,
            developmentApplication.onNoticeToDate,
            developmentApplication.address,
            developmentApplication.informationUrl,
            developmentApplication.commentUrl,
            developmentApplication.scrapeDate
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2NyYXBlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInNjcmFwZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsZ0dBQWdHO0FBQ2hHLDZCQUE2QjtBQUM3QixFQUFFO0FBQ0YsZUFBZTtBQUNmLG1CQUFtQjtBQUVuQixZQUFZLENBQUM7O0FBRWIsbUNBQW1DO0FBQ25DLGtEQUFrRDtBQUNsRCxtQ0FBbUM7QUFDbkMsaUNBQWlDO0FBRWpDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsQ0FBQztBQUVsQixNQUFNLDBCQUEwQixHQUFHLDJKQUEySixDQUFDO0FBQy9MLE1BQU0seUJBQXlCLEdBQUcsbUpBQW1KLENBQUM7QUFDdEwsTUFBTSxVQUFVLEdBQUcsd0NBQXdDLENBQUM7QUFFNUQsOEJBQThCO0FBRTlCLEtBQUssVUFBVSxrQkFBa0I7SUFDN0IsT0FBTyxJQUFJLE9BQU8sQ0FBQyxDQUFDLE9BQU8sRUFBRSxNQUFNLEVBQUUsRUFBRTtRQUNuQyxJQUFJLFFBQVEsR0FBRyxJQUFJLE9BQU8sQ0FBQyxRQUFRLENBQUMsYUFBYSxDQUFDLENBQUM7UUFDbkQsUUFBUSxDQUFDLFNBQVMsQ0FBQyxHQUFHLEVBQUU7WUFDcEIsUUFBUSxDQUFDLEdBQUcsQ0FBQyw2TEFBNkwsQ0FBQyxDQUFDO1lBQzVNLE9BQU8sQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUN0QixDQUFDLENBQUMsQ0FBQztJQUNQLENBQUMsQ0FBQyxDQUFDO0FBQ1AsQ0FBQztBQUVELDhEQUE4RDtBQUU5RCxLQUFLLFVBQVUsU0FBUyxDQUFDLFFBQVEsRUFBRSxzQkFBc0I7SUFDckQsT0FBTyxJQUFJLE9BQU8sQ0FBQyxDQUFDLE9BQU8sRUFBRSxNQUFNLEVBQUUsRUFBRTtRQUNuQyxJQUFJLFlBQVksR0FBRyxRQUFRLENBQUMsT0FBTyxDQUFDLDJEQUEyRCxDQUFDLENBQUM7UUFDakcsWUFBWSxDQUFDLEdBQUcsQ0FBQztZQUNiLHNCQUFzQixDQUFDLGlCQUFpQjtZQUN4QyxzQkFBc0IsQ0FBQyxXQUFXO1lBQ2xDLHNCQUFzQixDQUFDLGNBQWM7WUFDckMsc0JBQXNCLENBQUMsT0FBTztZQUM5QixzQkFBc0IsQ0FBQyxjQUFjO1lBQ3JDLHNCQUFzQixDQUFDLFVBQVU7WUFDakMsc0JBQXNCLENBQUMsVUFBVTtTQUNwQyxFQUFFLFVBQVMsS0FBSyxFQUFFLEdBQUc7WUFDbEIsSUFBSSxLQUFLLEVBQUU7Z0JBQ1AsT0FBTyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQztnQkFDbkIsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDO2FBQ2pCO2lCQUNJO2dCQUNELElBQUksSUFBSSxDQUFDLE9BQU8sR0FBRyxDQUFDO29CQUNoQixPQUFPLENBQUMsR0FBRyxDQUFDLCtCQUErQixzQkFBc0IsQ0FBQyxpQkFBaUIscUJBQXFCLHNCQUFzQixDQUFDLE9BQU8sd0JBQXdCLHNCQUFzQixDQUFDLFdBQVcsdUJBQXVCLENBQUMsQ0FBQzs7b0JBRXpOLE9BQU8sQ0FBQyxHQUFHLENBQUMsOEJBQThCLHNCQUFzQixDQUFDLGlCQUFpQixxQkFBcUIsc0JBQXNCLENBQUMsT0FBTyx3QkFBd0Isc0JBQXNCLENBQUMsV0FBVyxvREFBb0QsQ0FBQyxDQUFDO2dCQUN6UCxZQUFZLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBRSxxQkFBcUI7Z0JBQy9DLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQzthQUNoQjtRQUNMLENBQUMsQ0FBQyxDQUFDO0lBQ1AsQ0FBQyxDQUFDLENBQUM7QUFDUCxDQUFDO0FBRUQsd0NBQXdDO0FBRXhDLEtBQUssVUFBVSxJQUFJO0lBQ2YsbUNBQW1DO0lBRW5DLElBQUksUUFBUSxHQUFHLE1BQU0sa0JBQWtCLEVBQUUsQ0FBQztJQUUxQywwQkFBMEI7SUFFMUIsT0FBTyxDQUFDLEdBQUcsQ0FBQyxvQkFBb0IsMEJBQTBCLEVBQUUsQ0FBQyxDQUFDO0lBQzlELElBQUksSUFBSSxHQUFHLE1BQU0sT0FBTyxDQUFDLEVBQUUsR0FBRyxFQUFFLDBCQUEwQixFQUFFLENBQUMsQ0FBQztJQUM5RCxJQUFJLENBQUMsR0FBRyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO0lBRTNCLHFFQUFxRTtJQUVyRSxJQUFJLFNBQVMsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUM7SUFDNUQsSUFBSSxlQUFlLEdBQUcsQ0FBQyxDQUFDLGlDQUFpQyxDQUFDLENBQUMsR0FBRyxFQUFFLENBQUM7SUFDakUsSUFBSSxTQUFTLEdBQUcsQ0FBQyxDQUFDLDJCQUEyQixDQUFDLENBQUMsR0FBRyxFQUFFLENBQUM7SUFFckQsSUFBSSxTQUFTLEtBQUssQ0FBQztRQUNmLE9BQU8sQ0FBQyxHQUFHLENBQUMsWUFBWSxTQUFTLGlCQUFpQixDQUFDLENBQUE7O1FBRW5ELE9BQU8sQ0FBQyxHQUFHLENBQUMsc0JBQXNCLFNBQVMsa0JBQWtCLENBQUMsQ0FBQTtJQUVsRSxtQ0FBbUM7SUFFbkMsS0FBSyxJQUFJLFNBQVMsR0FBRyxDQUFDLEVBQUUsU0FBUyxJQUFJLEVBQUUsRUFBRSxTQUFTLEVBQUUsRUFBRSxFQUFHLDBEQUEwRDtRQUMvRyxPQUFPLENBQUMsR0FBRyxDQUFDLGdCQUFnQixTQUFTLEdBQUcsQ0FBQyxDQUFDO1FBRTFDLDhCQUE4QjtRQUU5QixJQUFJLFNBQVMsSUFBSSxDQUFDLEVBQUU7WUFDaEIsSUFBSTtnQkFDQSxJQUFJLElBQUksR0FBRyxNQUFNLE9BQU8sQ0FBQyxJQUFJLENBQUM7b0JBQzFCLEdBQUcsRUFBRSwwQkFBMEI7b0JBQy9CLE9BQU8sRUFBRSxFQUFFLGNBQWMsRUFBRSxtQ0FBbUMsRUFBRTtvQkFDaEUsSUFBSSxFQUFFO3dCQUNGLGVBQWUsRUFBRSxRQUFRLFNBQVMsRUFBRTt3QkFDcEMsYUFBYSxFQUFFLHFFQUFxRTt3QkFDcEYsaUJBQWlCLEVBQUUsZUFBZTt3QkFDbEMsV0FBVyxFQUFFLFNBQVM7cUJBQzdCO2lCQUFDLENBQUMsQ0FBQztnQkFDSixDQUFDLEdBQUcsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztnQkFDdkIsZUFBZSxHQUFHLENBQUMsQ0FBQyxpQ0FBaUMsQ0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDO2dCQUM3RCxTQUFTLEdBQUcsQ0FBQyxDQUFDLDJCQUEyQixDQUFDLENBQUMsR0FBRyxFQUFFLENBQUM7YUFDcEQ7WUFBQyxPQUFPLEVBQUUsRUFBRTtnQkFDVCxPQUFPLENBQUMsR0FBRyxDQUFDLDBCQUEwQixFQUFFLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQztnQkFDcEQsTUFBTTthQUNUO1NBQ0o7UUFFRCwrRUFBK0U7UUFFL0UsS0FBSyxJQUFJLE9BQU8sSUFBSSxDQUFDLENBQUMscURBQXFELENBQUMsQ0FBQyxHQUFHLEVBQUUsRUFBRTtZQUNoRixJQUFJLEdBQUcsR0FBRyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDO1lBQzdFLElBQUksR0FBRyxDQUFDLE1BQU0sR0FBRyxDQUFDO2dCQUNkLFNBQVM7WUFFYixJQUFJLGlCQUFpQixHQUFHLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUMvQixJQUFJLFlBQVksR0FBRyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLFdBQVcsRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFFLG1EQUFtRDtZQUMxRyxJQUFJLFdBQVcsR0FBRyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDekIsSUFBSSxPQUFPLEdBQUcsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBRXJCLGdFQUFnRTtZQUVoRSxJQUFJLENBQUMsa0NBQWtDLENBQUMsSUFBSSxDQUFDLGlCQUFpQixDQUFDLElBQUksT0FBTyxLQUFLLEVBQUU7Z0JBQzdFLFNBQVM7WUFFYixNQUFNLFNBQVMsQ0FBQyxRQUFRLEVBQUU7Z0JBQ3RCLGlCQUFpQixFQUFFLGlCQUFpQjtnQkFDcEMsT0FBTyxFQUFFLE9BQU87Z0JBQ2hCLFdBQVcsRUFBRSxDQUFDLENBQUMsV0FBVyxLQUFLLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDLENBQUMsV0FBVyxDQUFDO2dCQUM3RSxjQUFjLEVBQUUseUJBQXlCLENBQUMsT0FBTyxDQUFDLFFBQVEsRUFBRSxpQkFBaUIsQ0FBQztnQkFDOUUsVUFBVSxFQUFFLFVBQVU7Z0JBQ3RCLFVBQVUsRUFBRSxNQUFNLEVBQUUsQ0FBQyxNQUFNLENBQUMsWUFBWSxDQUFDO2dCQUN6QyxZQUFZLEVBQUUsWUFBWSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsWUFBWSxDQUFDLE1BQU0sQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRTthQUM5RSxDQUFDLENBQUM7U0FDTjtLQUNKO0FBQ0wsQ0FBQztBQUVELElBQUksRUFBRSxDQUFDLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDIn0=