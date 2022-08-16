const misc = require("./misc.js");
const sql = require("./sql.js");
const webSqlPool = sql.webSqlConnect();
let SETTINGS = {};

async function qrySettings()
{
    return new Promise(function(resolve, reject) {
        sql.qry2(webSqlPool, "select * from `settings`", [], function (data) {
            if (misc.objLength(data) > 0)
            {
                for (let k in data)
                {
                    SETTINGS[data[k].setting] = data[k].value;
                }
            }
            resolve(SETTINGS);
        });
    });
}

module.exports = {
    settings: SETTINGS,
    qrySettings: qrySettings,
};