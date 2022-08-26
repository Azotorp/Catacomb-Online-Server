const misc = require("./misc.js");
const sql = require("./sql.js");
const serverSQLPool = sql.serverSQLConnect();
let SETTINGS = {};
let access = {
    levels: {},
    levelIDs: [],
};

async function getSettings()
{
    return new Promise(function(resolve, reject) {
        sql.qry2(serverSQLPool, "select * from `settings`", [], function (data) {
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

async function getAccessLevels()
{
    return new Promise(function (resolve, reject) {
        sql.qry(serverSQLPool, "select * from `access_levels` order by `level`", [], function (data) {
            for (let k in data)
            {
                if (data.hasOwnProperty(k))
                {
                    access.levels[data[k].rank] = {
                        rank: data[k].rank,
                        level: data[k].level,
                        maxInstances: data[k].max_instances,
                    };
                    access.levelIDs.push(data[k].rank);
                }
            }
            resolve(access);
        });
    });
}

module.exports = {
    access: access,
    settings: SETTINGS,
    getSettings: getSettings,
    getAccessLevels: getAccessLevels,
};