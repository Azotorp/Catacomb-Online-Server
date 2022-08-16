const { readFileSync } = require("fs");
const { createServer } = require("https");
const { Server } = require("socket.io");
const sql = require("./modules/sql.js");
const generalConfig = require("../config/general_config.json");
const port = process.env.PORT || 3000;
const misc = require("./modules/misc.js");
const physics = require("./modules/physics.js");
const map = require("./modules/map.js");
const engine = require("./modules/engine.js");
const stringy = require("./modules/circular.js");
const settings = require("./modules/settings.js");
const webSqlPool = sql.webSqlConnect();
const httpServer = createServer({
    key: readFileSync(generalConfig.sslPrivateKeyPath + "/" + generalConfig.sslPrivateKeyFile), // use let's encrypt to get SSL
    cert: readFileSync(generalConfig.sslCertPath + "/" + generalConfig.sslCertFile), // use let's encrypt to get SSL
    passphrase: generalConfig.sslPrivateKeyPassPhrase,
});

let players = {};
let playerID = 0;
const io = new Server(httpServer, {
    cors: {
        origin: "https://" + generalConfig.clientHostDomainName;
    }
});

let serverRunning = false;
let playerScale = 1;
let realWorldScale = 0.00761461306 / playerScale; // meters per pixel
let accessLevels = {};
let accessLevelsIds = [];
let frameTickTime;
let FPS;
let mapData = [];
let SETTINGS = {}
let gridSize;
let mapSize = {};
let winCenterX;
let winCenterY;
let zoom = 1;
let startTime = misc.now();

sql.qry(webSqlPool, "select * from `access_levels` order by `level`", [], function (data) {

    for (let k in data)
    {
        if (data.hasOwnProperty(k))
        {
            accessLevels[data[k].rank] = {
                rank: data[k].rank,
                level: data[k].level,
                maxInstances: data[k].max_instances,
            };
            accessLevelsIds.push(data[k].rank);
        }
    }
});

io.on("connection", (socket) => {
    let uuid = misc.sha256(socket.id);
    dump("User "+uuid+" connected.");

    socket.on("clientReady", async function(data) {
        SETTINGS = await settings.qrySettings();
        playerScale = parseFloat(SETTINGS.playerScale);
        gridSize = parseInt(parseInt(SETTINGS.gridSize) * playerScale);
        realWorldScale = 0.00761461306 / playerScale; // meters per pixel
        mapSize = {
            x: parseInt(SETTINGS.mapWidth),
            y: parseInt(SETTINGS.mapHeight),
        };
        mapData = await map.generateMap(mapSize.x, mapSize.y);
        let auth = data.auth;
        winCenterX = data.winCenterX;
        winCenterY = data.winCenterY;
        zoom = data.zoom;
        sql.qry2(webSqlPool, "select * from `user_auth` where `user_id` = ?", [auth.userID], function() {
            let instances = 0;//result.open_instances;
            let access = misc.filterObj2(accessLevels, "level", auth.level);
            if (instances < access.maxInstances || access.maxInstances === -1)
            {
                let accTimer = (1 / FPS) * 1000;
                let deAccTimer = (1 / FPS) * 1000;
                let playerData = {
                    authLevel: auth.level,
                    authUsername: auth.username,
                    authUserID: auth.userID,
                    authIP: auth.ip,
                    authKey: auth.key,
                    playerID: playerID,
                    uuid: uuid,
                    turnSpeed: 360,
                    forwardsAcceleration: 0.5 / realWorldScale,
                    forwardsDeAcceleration: 0.1 / realWorldScale,
                    backwardsAcceleration: 0.25 / realWorldScale,
                    backwardsDeAcceleration: 0.2 / realWorldScale,
                    strafeAcceleration: 0.4,
                    strafeDeAcceleration: 0.2,
                    forwardsMaxSpeed: 1.56 / realWorldScale,
                    backwardsMaxSpeed: 0.75 / realWorldScale,
                    strafeMaxSpeed: 1.3 / realWorldScale,
                    runBonusSpeed: 2,
                    currentSpeed: 0,
                    forwardsSpeed: 0,
                    backwardsSpeed: 0,
                    strafeLeftSpeed: 0,
                    strafeRightSpeed: 0,
                    accelerationNextThink: misc.now() + accTimer,
                    deAccelerationNextThink: misc.now() + deAccTimer,
                    momentumDir: 0,
                    forwards: false,
                    backwards: false,
                    strafeLeft: false,
                    strafeRight: false,
                    isRunning: false,
                    stopPlayerTurn: false,
                };
                let pos = {x: 0, y: 0};
                physics.newPlayerBody(playerID, pos, data.player.width, data.player.height);
                playerData.body = {
                    position: [physics.playerBody[playerID].position[0], physics.playerBody[playerID].position[1]],
                    angle: physics.playerBody[playerID].angle,
                };
                playerData.chunkPos = misc.calcChunkPos(playerData.body.position, gridSize);
                players[playerID] = playerData;
                sql.qry(webSqlPool, "update `user_auth` set `last_ping` = ?, `online` = 'Y' where `user_id` = ?", [misc.time(), auth.userID], function() {});
                sql.qry(webSqlPool, "update `user_auth` set `open_instances` = `open_instances` + 1 where `user_id` = ?", [auth.userID], function() {});

                /*
                let foundTile = [];
                let maxChunkLoadX = 5;
                let maxChunkLoadY = 5;
                let playerChunkPos = {x: players[playerID].chunkPos[0], y: players[playerID].chunkPos[1]};
                for (let sy = -maxChunkLoadY; sy <= maxChunkLoadY; sy++)
                {
                    for (let sx = -maxChunkLoadX; sx <= maxChunkLoadX; sx++)
                    {
                        let x = playerChunkPos.x + sx;
                        let y = playerChunkPos.y + sy;
                        let index = misc.getIndexFromChunkPos({x: x, y: y}, mapSize);
                        foundTile.push(mapData[index]);
                    }
                }

                 */
                io.emit("newPlayer", {playerData: playerData, players: players});//, mapData: foundTile});
                playerID++;
                dump(misc.now() - startTime);
            } else {
                io.emit("maxInstances", uuid);
            }
        });
    });

    socket.on('disconnect', () => {
        dump("User "+uuid+" disconnected.");
        let data = misc.filterObj2(players, "uuid", uuid);
        if (misc.objLength(data) > 0)
        {
            let playerID = data.playerID;
            physics.world.removeBody(physics.playerBody[playerID]);
            delete players[playerID];
            io.emit("userDisconnect", {
                players: players,
                playerID: playerID,
            });
            sql.qry(webSqlPool, "update `user_auth` set `last_ping` = ?, `online` = 'N' where `user_id` = ?", [misc.time(), data.authUserID], function() {});
            sql.qry(webSqlPool, "update `user_auth` set `open_instances` = `open_instances` - 1 where `user_id` = ?", [data.authUserID], function() {});
            sql.qry2(webSqlPool, "select `open_instances` from `user_auth` where `user_id` = ?", [data.authUserID], function(result) {
                if (result < 0)
                {
                    sql.qry(webSqlPool, "update `user_auth` set `open_instances` = 0 where `user_id` = ?", [data.authUserID], function() {});
                }
            });
        }
    });

    socket.on('updatePos', msg => {
        let func = msg.func;
        let id = msg.id;
        if (misc.isDefined(players[id]))
        {
            sql.qry(webSqlPool, "update `user_auth` set `last_ping` = ?, `online` = 'Y' where `user_id` = ?", [misc.time(), players[id].authUserID], function() {});
            if (func === "run")
            {
                players[id].isRunning = true;
            }
            if (func === "runStop")
            {
                players[id].isRunning = false;
            }
            if (func === "upStop")
            {
                players[id].forwards = false;
                players[id].backwards = false;
            }
            if (func === "downStop")
            {
                players[id].forwards = false;
                players[id].backwards = false;
            }
            if (func === "leftStop")
            {
                players[id].strafeLeft = false;
            }
            if (func === "rightStop")
            {
                players[id].strafeRight = false;
            }
            if (func === "up")
            {
                players[id].forwards = true;
                players[id].backwards = false;
            }
            if (func === "down")
            {
                players[id].forwards = false;
                players[id].backwards = true;
            }
            if (func === "left")
            {
                players[id].strafeLeft = true;
                players[id].strafeRight = false;
            }
            if (func === "right")
            {
                players[id].strafeLeft = false;
                players[id].strafeRight = true;
            }
        }
    });
    socket.on('updateServer', msg => {  // MAIN LOOP
        let id = msg.id;
        let mouse = {x: msg.mouse.x, y: msg.mouse.y};
        frameTickTime = msg.frameTickTime;
        FPS = msg.fps;
        zoom = msg.zoom;
        winCenterX = msg.winCenterX;
        winCenterY = msg.winCenterY;
        let foundTile = [];
        if (misc.isDefined(players[id]))
        {
            let pos = {x: physics.playerBody[id].position[0], y: physics.playerBody[id].position[1]};
            let mouseAngle = misc.angle(pos, mouse);
            let angleDist = misc.angleDist(mouseAngle, physics.playerBody[id].angle);
            let turnDir = misc.angleMoveDir(mouseAngle, physics.playerBody[id].angle);
            if (misc.toDeg(angleDist) > players[id].turnSpeed / FPS)
            {
                physics.playerBody[id].angularVelocity = misc.toRad(players[id].turnSpeed) * turnDir;
            } else {
                physics.playerBody[id].angularVelocity = 0;
                physics.playerBody[id].angle = mouseAngle;
                //players[id].stopPlayerTurn = true;
                //setTimeout(function () {
                //players[id].stopPlayerTurn = false;
                //}, 50);
            }
            //getMapData(gridSize);
            engine.updatePlayersPos(players, FPS, gridSize);
            let maxChunkLoadX = Math.ceil(((winCenterX * zoom) - (gridSize / 2)) / gridSize) + 1;
            let maxChunkLoadY = Math.ceil(((winCenterY * zoom) - (gridSize / 2)) / gridSize) + 1;
            let playerChunkPos = {x: players[id].chunkPos[0], y: players[id].chunkPos[1]};
            for (let sy = -maxChunkLoadY; sy <= maxChunkLoadY; sy++)
            {
                for (let sx = -maxChunkLoadX; sx <= maxChunkLoadX; sx++)
                {
                    let x = playerChunkPos.x + sx + Math.floor(mapSize.x / 2);
                    let y = playerChunkPos.y + sy + Math.floor(mapSize.y / 2);
                    //if (x > 0 && y > 0 && x < mapSize.x && y < mapSize.y)
                    let index = misc.getIndexFromChunkPos({x: x, y: y}, mapSize);
                    if (misc.isDefined(mapData[index]))
                    {
                        foundTile.push(mapData[index]);
                        if (mapData[index].tile === "wall")
                        {
                            let wallBody = misc.calcGlobalPos({x: mapData[index].chunkPosX, y: mapData[index].chunkPosY}, gridSize);
                            physics.newWallBody(mapData[index].id, wallBody, gridSize, gridSize);
                        }
                    }
                }
            }
            io.emit("serverUpdate", {
                mapData: foundTile,
                players: players,
            });
        }
        physics.world.step(1 / FPS, frameTickTime / 1000, 2);
    });
});

httpServer.listen(port, async function() {
    dump(`Socket.IO server running at http://localhost:${port}/`);
    serverRunning = true;
    sql.qry(webSqlPool, "UPDATE `user_auth` SET `online` = 'N', `open_instances` = 0", [], function() {});
    //mapData = await map.loadMapData(gridSize);
});


physics.world.on("impact",function(evt) {
    let bodyA = evt.bodyA, bodyB = evt.bodyB;
    let id;
    let body;
    if ((bodyA.object === "wall" && bodyB.object === "player") || (bodyB.object === "wall" && bodyA.object === "player"))
    {
        let idA = bodyA.objectID;
        let idB = bodyB.objectID;
        if (bodyA.object === "wall")
        {
            id = idA;
            //body = bodyA;
        } else {
            id = idB;
            //body = bodyB;
        }
        dump(mapData[id]);
    }
});

async function getMapData()
{
    mapData = await map.loadMapData(gridSize);
}

function dump(input)
{
    console.log(input);
    io.emit("serverDump", stringy.stringify(input));
}
