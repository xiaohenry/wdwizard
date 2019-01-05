/*
 * 1. Take 2 csv inputs
 * 2. Convert both to json arrays - let's call them originalJson & newJson. Each json object represents a csv row
 * 3. Compare the two json (the two rows):
 *      if brainstormId is in both json --> update originalJson with the newJson data (the new row's data)
 *      if brainstormId is in originalJson only --> remove this row from originalJson (the brainstorm was closed)
 *      if brainstormId is in newJson only --> add this row to originalJson (a new brainstorm was added)
 */

// Use JS File to read in csv file as str
// Pass csv string to csvtojson
var csvtojson = require('csvtojson');
var json2csv = require('json2csv').parse;
var fs = require('fs');

var originalFile = process.argv[2];
var newFile = process.argv[3];

var columnsOfInterest = [];
var rowsAdded = [];
var rowsRemoved = [];
var rowsUpdated = [];
var rowsUnchanged = [];

doWork();

function doWork() {
    console.log(`Original file : ${originalFile}`);
    console.log(`New file: ${newFile}`);
    var originalCsvPromise = processCsv(originalFile);
    var newCsvPromise = processCsv(newFile);

    Promise.all([originalCsvPromise, newCsvPromise]).then(results => {
        // async process both csv files, and wait for them to proceed
        var originalJson = preprocessJson(results[0]);
        var newJson = preprocessJson(results[1]);
        markColumnsOfInterest(originalJson);
        compare(originalJson, newJson);
        outputResults(originalJson);
    }).catch(err => {
        console.log(err);
    });
}

// async convert a csv file to a json[], where each json object represents a row in the csv file
function processCsv(csvFile) {
    console.log(`Reading ${csvFile}`);
    return new Promise((resolve, reject) => {
        var json = csvtojson().fromFile(csvFile);
        if (json) {
            return resolve(json)
        } else {
            return reject(json);
        }
    });
}

function outputResults(json) {
    createCsvOutput(json);
    console.log(`\nAdded rows: ${rowsAdded.length}`);
    console.log(`\nRemoved rows: ${rowsRemoved.length}`);
    console.log(`\nUpdated rows: ${rowsUpdated.length}`);
    console.log(`\nUnchanged rows: ${rowsUnchanged.length}`);
}

function createCsvOutput(json) {
    var options = {'encoding': 'utf-8'};
    var csv = json2csv(json, options);
    var date = new Date().toLocaleDateString().replace(/\//g, "_");
    var outputFile = `results_${date}.csv`;

    fs.writeFile(outputFile, csv, err => {
        if(err) {
            return console.log(err);
        }

        console.log(`\nSuccess! Results were written to ${outputFile}! \n`);
    });
}

function compare(originalJson, newJson) {
    var originalBrainstormMap = markOccurrences(originalJson);
    var newBrainstormMap = markOccurrences(newJson);
    console.log(`Rows in original file : ${Object.keys(originalBrainstormMap).length + 1}`);
    console.log(`Rows in new  file : ${Object.keys(newBrainstormMap).length + 1}`);
    removeAndUpdateBrainstorms(originalJson, newJson, newBrainstormMap);
    addNewBrainstorms(originalJson, newJson, originalBrainstormMap);
    addBrainstormUrls(originalJson);
}

function removeAndUpdateBrainstorms(originalJson, newJson, newBrainstormMap) {
    // Be careful with looping and removing items
    for (var i=originalJson.length-1; i>=0; i--) {
        var row = originalJson[i];
        var brainstormId = row[`Brainstorm_ID`];

        if (!newBrainstormMap[brainstormId]) {
            // brainstorm was closed
            originalJson.splice(i, 1);
            rowsRemoved.push(brainstormId);
        } else {
            // update the brainstorm
            var newRow = newBrainstormMap[brainstormId];
            var rowUpdated = false;
            Object.keys(newRow).forEach(column => {
                // check if a column of interest was updated
                if (columnsOfInterest.includes(column) && row[column] !== newRow[column]) {
                    row[column] = newRow[column];
                    rowUpdated = true;
                }
            });

            if (rowUpdated) {
                rowsUpdated.push(brainstormId);
            } else {
                rowsUnchanged.push(brainstormId);
            }
        }
    }
}

function addNewBrainstorms(originalJson, newJson, originalBrainstormMap) {
    newJson.forEach(row => {
        var brainstormId = row[`Brainstorm_ID`];
        if (!originalBrainstormMap[brainstormId]) {
            var rowWithCommonColumnsOfInterest = {};
            Object.keys(row).forEach(column => {
                if (columnsOfInterest.includes(column)) {
                    rowWithCommonColumnsOfInterest[column] = row[column];
                }
            })

            // add the new row
            originalJson.push(rowWithCommonColumnsOfInterest);
            rowsAdded.push(brainstormId);
        }
    })
}

function addBrainstormUrls(originalJson) {
    originalJson.forEach(row => {
        var brainstormId = row[`Brainstorm_ID`];
        var brainstormHyperlink = `=HYPERLINK("https://community.workday.com/brainstorms/${brainstormId}", "Link")`;
        row[`Brainstorm_URL`] = brainstormHyperlink;
    });
}

// Take the first row of the original file to check which columns we care about
function markColumnsOfInterest(originalJson) {
    var sampleRow = originalJson[0];
    Object.keys(sampleRow).forEach(column => {
        if (sampleRow.hasOwnProperty(column)) {
            console.log(`Adding column of interst ${column}`);
            columnsOfInterest.push(column);
        }
    })
}

// remove any "fake" rows - rows without a Brainstorm_ID
function preprocessJson(json) {
    var filteredJson = json.filter(row => {
        var brainstormId = row['Brainstorm_ID'];
        brainstormId.replace(/ /g, '');
        return brainstormId || brainstormId.length
    });

    return filteredJson;
}

// map of {'brainstormId': {brainstormJson} } }
function markOccurrences(json) {
    var occurrenceMap = {};
    json.forEach(row => {
        occurrenceMap[row['Brainstorm_ID']] = row;
    });

    return occurrenceMap;
}
