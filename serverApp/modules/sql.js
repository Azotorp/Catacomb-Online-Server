const mysql = require('mysql');
const mysqlConfig = require("../config/mysql_config.json");
const misc = require("./misc.js");

let webSqlConnect = function() {
    const pool = mysql.createPool({
        host     : mysqlConfig.web_sql_host,
        user     : mysqlConfig.web_sql_user,
        password : mysqlConfig.web_sql_pass,
        database : mysqlConfig.web_sql_db,
        charset : 'utf8mb4'
    });
    return pool;
};

let localSqlConnect = function() {
    const pool = mysql.createPool({
        host     : mysqlConfig.local_sql_host,
        user     : mysqlConfig.local_sql_user,
        password : mysqlConfig.local_sql_pass,
        database : mysqlConfig.local_sql_db,
        charset : 'utf8mb4'
    });
    return pool;
};

function dump(input)
{
    console.log(input);
}

function qry(pool, query_str, query_var, data)
{
    pool.getConnection((err, connection) => {
        if(err) throw err;
        connection.query({
            sql: query_str,
            timeout: 40000, // 40s
            values: query_var
        }, function (error, results) {
            data(results);
            // error will be an Error if one occurred during the query
            // results will contain the results of the query
            // fields will contain information about the returned results fields (if any)
        });
        connection.release();
    });
}

function qry2(pool, query_str, query_var, data)
{
    pool.getConnection((err, connection) => {
        if(err) throw err;
        connection.query({
            sql: query_str,
            timeout: 40000, // 40s
            values: query_var
        }, function (error, results, fields) {
            if (results.length === 1)
            {
                if (misc.objLength(results[0]) === 1)
                {
                    let val = Object.values(results[0]);
                    data(val[0]);
                } else {
                    data(results[0]);
                }
            } else {
                data(results);
            }
            // error will be an Error if one occurred during the query
            // results will contain the results of the query
            // fields will contain information about the returned results fields (if any)
        });
        connection.release();
    });
}


module.exports = {
    webSqlConnect: webSqlConnect,
    localSqlConnect: localSqlConnect,
    qry: qry,
    qry2: qry2,
};