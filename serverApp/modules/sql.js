const mysql = require('mysql');
const mysqlConfig = require("../config/mysql_config.json");
const misc = require("./misc.js");
const fs = require("fs");
const { readFileSync } = require("fs");
const path = require('path');

let serverSQLConnect = function() {
    const pool = mysql.createPool({
        host     : mysqlConfig.local_sql_host,
        user     : mysqlConfig.local_sql_user,
        password : mysqlConfig.local_sql_pass,
        database : mysqlConfig.local_sql_db,
        charset : 'utf8mb4'
    });
    return pool;
};

let clientSQLConnect = function() {
    const pool = mysql.createPool({
        host     : mysqlConfig.web_sql_host,
        user     : mysqlConfig.web_sql_user,
        password : mysqlConfig.web_sql_pass,
        database : mysqlConfig.web_sql_db,
        charset : 'utf8mb4'
    });
    return pool;
};

function qry(pool, query_str, query_var, data)
{
    pool.getConnection((err, connection) => {
        if(err)
            throw err;
        try {
            connection.query({
                sql: query_str,
                timeout: 40000, // 40s
                values: query_var
            }, function (error, results) {
                if (error)
                    throw error;
                try {
                    data(results, error);
                    // error will be an Error if one occurred during the query
                    // results will contain the results of the query
                    // fields will contain information about the returned results fields (if any)
                } catch (e) {
                    //console.error(e);
                }
            });
        } catch (e) {
            //console.error(e);
        }
        connection.release();
    });
}

function qry2(pool, query_str, query_var, data)
{
    pool.getConnection((err, connection) => {
        if(err)
            throw err;
        try {
            connection.query({
                sql: query_str,
                timeout: 40000, // 40s
                values: query_var
            }, function (error, results, fields) {
                if (error)
                    throw error;
                try {
                    if (results.length === 1)
                    {
                        if (misc.objLength(results[0]) === 1)
                        {
                            let val = Object.values(results[0]);
                            data(val[0], error);
                        } else {
                            data(results[0], error);
                        }
                    } else {
                        data(results, error);
                    }
                    // error will be an Error if one occurred during the query
                    // results will contain the results of the query
                    // fields will contain information about the returned results fields (if any)
                } catch (e) {
                    console.error(e);
                }
            });
        } catch (e) {
            console.error(e);
        }
        connection.release();
    });
}

async function dbVersion()
{
    return new Promise((resolve, reject) => {
        qry2(serverSQLConnect(), "select `database_version` from `db_version`", [], function (data) {
            resolve(data);
        });
    });
}

async function updateSQLVersion()
{
    return new Promise(async function(resolve, reject) {
        let dbVer = await dbVersion();
        const sqlUpdatesDirectoryPath = path.join(__dirname, '../../sql/updates');
        fs.readdir(sqlUpdatesDirectoryPath, async function (err, files) {
            if (err) {
                return console.log('Unable to scan directory: ' + err);
            }
            let latestVersionFile = 0;
            files.forEach(function (file) {
                let sqlNum = parseInt(file.split(".")[0]);
                if (sqlNum > latestVersionFile)
                    latestVersionFile = sqlNum;
            });
            if (latestVersionFile > dbVer)
            {
                for (let v = dbVer + 1; v <= latestVersionFile; v++)
                {
                    let query = misc.eol(readFileSync(sqlUpdatesDirectoryPath + "/" + v + ".sql", 'utf8').toString());
                    query = query.split(/;\n/);
                    for (let q in query)
                    {
                        if (query[q].length > 0 && query[q])
                            await doInstallQry(query[q]);
                    }
                    dump("SQL Queried: "+v+".sql");
                }
                qry(serverSQLConnect(), "UPDATE `db_version` SET `database_version` = ?", [latestVersionFile], function () {});
                resolve(latestVersionFile);
            } else {
                resolve(dbVer);
            }
        });
    });
}

async function doInstallQry(query)
{
    return new Promise(async function(resolve) {
        if (query.length === 0 || !query)
            resolve(false);
        qry(serverSQLConnect(), query, [], function (data, error) {
            resolve(true);
        });
    });
}

async function dbInstall()
{
    return new Promise(async function(resolve, reject) {

        const sqlInstallDirectoryPath = path.join(__dirname, '../../sql');
        let query = misc.eol(readFileSync(sqlInstallDirectoryPath + "/database.sql", 'utf8').toString());
        query = query.split(/;\n/);
        for (let q in query)
        {
            await doInstallQry(query[q]);
        }
        dump("SQL Queried: database.sql\n");
        dump("{FgYellow}########### {FgMagenta}! {FgRed}WARNING {FgMagenta}! {FgYellow}###########");
        dump("{FgCyan}Set the following constant to {FgYellow}FALSE {FgCyan}in the {FgWhite}index.js {FgCyan}file near line {FgGreen}22");
        dump("{FgMagenta}const {FgWhite}INSTALL_NEW_DATABASE = {FgYellow}false{FgWhite};");
        dump("{FgYellow}########### {FgMagenta}! {FgRed}WARNING {FgMagenta}! {FgYellow}###########\n");
        process.exit();
        resolve(true);
    });
}

function dump(input, table = false, label = false, remoteConn = false)
{
    return misc.dump(input, table, label, remoteConn);
}

module.exports = {
    clientSQLConnect: clientSQLConnect,
    serverSQLConnect: serverSQLConnect,
    qry: qry,
    qry2: qry2,
    dbVersion: dbVersion,
    updateSQLVersion: updateSQLVersion,
    dbInstall: dbInstall,
};