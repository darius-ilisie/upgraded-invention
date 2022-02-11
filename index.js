const InputDataDecoder = require('ethereum-input-data-decoder');
const decoder = new InputDataDecoder(`${__dirname}/abi.json`);
const axios = require("axios");
const Datastore = require("nedb"), db = new Datastore({ filename: 'tx.db', autoload: true });

function sleep(ms) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

var BSC_API = "QH7GXPW1MSN3N4TUPT9E4FN4IKJS4817KE";
var ADDRESS = "0x5aF6D33DE2ccEC94efb1bDF8f92Bd58085432d2c"; //PancakeSwap Contract

var LAST_BLOCK;
var HAVE_START = false;
const SORT = "desc"

async function getLastTXs() {
    return axios
        .get("https://api.bscscan.com/api?module=account&action=txlist&address=" + ADDRESS + "&sort=" + SORT + "&apikey=" + BSC_API)
        .then(res => {
            return res.data;
        })
        .catch(error => {
            console.log(error);
        })
}

async function getLastTXsFrom(blockid) {
    return axios
        .get("https://api.bscscan.com/api?module=account&action=txlist&address=" + ADDRESS + "&startblock=" + blockid + "&sort=" + SORT + "&apikey=" + BSC_API)
        .then(res => {
            return res.data;
        })
        .catch(error => {
            console.log(error);
        })
}

async function updateDB() {
    var finished_lottery = false;
    var filtered_txs = [];
    var txs = (await getLastTXsFrom(LAST_BLOCK)).result;

    txs.pop(); // This is the last tx which is in db
    if(txs.length == 0) {
        console.log("[+] updateDB: No new txs found!");
    } else {
        console.log("[+] updateDB: Update db with: " + txs.length + " new txs.");
        for(var i = 0; i < txs.length; i++) {
            var element = txs[i];

            element.input = decoder.decodeData(element.input);

            if(element.input.method != "startLottery") {
                if(element.input.method != "claimTickets") {
                    filtered_txs.push(element);
                }
            } else {
                finished_lottery = true;
                break;
            }
        }
    }

    if(finished_lottery == true) {
        return;
    } else {
        sleep(5000)
        updateDB();
    }
}

async function initDB() {
    var filtered_txs = [];
    var last_txs = (await getLastTXs()).result;
    for(var i = 0; i < last_txs.length; i++) {
        var element = last_txs[i];

        element.input = decoder.decodeData(element.input);

        if(element.input.method == "buyTickets") {
            filtered_txs.push(element);
        } else if (element.input.method == "startLottery") {
            filtered_txs.push(element);
            HAVE_START = true;
            break;
        }
    };
    LAST_BLOCK = filtered_txs[0].blockNumber;
    return new Promise((res, rej) => {
        db.insert(filtered_txs, (err, docs) => {
            if(docs.length == 0) {
                res(true);
            } else {
                res(false);
            }
        })
    })
}

async function main() {
    await initDB();
    if(HAVE_START == false) {
        console.log("[!] WIP, didn't get the startLottery from last 10000 records!");
        return;
    }

    updateDB();
}

main();