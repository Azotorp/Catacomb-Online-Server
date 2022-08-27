const mysql = require('mysql');
const mysqlConfig = require("../config/mysql_config.json");
const misc = require("./misc.js");

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

function dump(input)
{
    console.log(input);
}

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


module.exports = {
    clientSQLConnect: clientSQLConnect,
    serverSQLConnect: serverSQLConnect,
    qry: qry,
    qry2: qry2,
};