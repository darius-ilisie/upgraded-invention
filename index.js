const InputDataDecoder = require('ethereum-input-data-decoder');
const decoder = new InputDataDecoder(`${__dirname}/abi.json`);
const axios = require("axios");
const Datastore = require("nedb"), db = new Datastore({ filename: 'tx.db', autoload: true });


var BSC_API = "QH7GXPW1MSN3N4TUPT9E4FN4IKJS4817KE";
var ADDRESS = "0x5aF6D33DE2ccEC94efb1bDF8f92Bd58085432d2c"; //PancakeSwap Contract

const PAGE = 1;
const OFFSET = 32;
const SORT = "asc"; //asc | desc

var START_BLOCK = 15102655n;
var END_BLOCK = 99999999n;





async function getTXs(sblock, eblock) {
    return axios
        .get("https://api.bscscan.com/api?module=account&action=txlist&address=" + ADDRESS + "&startblock=" + sblock + "&endblock=" + eblock + "&page=" + PAGE + "&offset=" + OFFSET + "&sort=" + SORT + "&apikey=" + BSC_API)
        .then(res => {
            return res.data;
        })
        .catch(error => {
            console.log(error);
        })
}

function checkIfEmpty() {
    return new Promise((res, rej) => {
        db.find({}, (err, docs) => {
            if (docs.length == 0) {
                res(true);
            } else {
                res(false);
            }
        })
    })
}

async function populateDB(sblock, eblock) {
    var txs = await getTXs(sblock, eblock);
    var exp_len = 32
    if (await checkIfEmpty() == false) {
        txs.result.shift();
        exp_len = 31;
    }

    txs.result.forEach((e, i) => {
        var data = decoder.decodeData(e.input);
        txs.result[i].input = data;
        txs.result[i].method = data.method;
    });

    if (txs.result.length == 0) {
        console.log("[+] No new tx. Waiting 15 sec")
    } else {
        console.log("[+] Found " + txs.result.length + " new tx(s)!");
        console.log("[+] Adding to db.");
        db.insert(txs.result, (err, newTxs) => {
            var new_sblock = newTxs[newTxs.length - 1].blockNumber;
            if (newTxs.length == exp_len) {
                return populateDB(new_sblock, eblock);
            } else {
                START_BLOCK = new_sblock;
                return 0;
            }
        })
    }
}

async function main() {
    if (await checkIfEmpty() == false) {
        db.find({}).sort({ timeStamp: -1 }).limit(1).exec((err, data) => {
            START_BLOCK = data.blockNumber;
        })
    }
    await populateDB(START_BLOCK, END_BLOCK);
    const INTERV = setInterval(populateDB, 15000, [START_BLOCK, END_BLOCK]);
}

main();