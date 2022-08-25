const { readFileSync } = require("fs");
const { createServer } = require("https");
const { Server } = require("socket.io");
const sql = require("./modules/sql.js");
const generalConfig = require("./config/general_config.json");
const socketIOPort = generalConfig.socketIOPort;
const socketIOHost = generalConfig.socketIOHost;
const misc = require("./modules/misc.js");
const physics = require("./modules/physics.js");
const map = require("./modules/map.js");
const engine = require("./modules/engine.js");
const stringy = require("./modules/circular.js");
const settings = require("./modules/settings.js");
const serverSQLPool = sql.serverSQLConnect();
const httpServer = createServer({
    key: readFileSync(generalConfig.sslPrivateKeyPath + "/" + generalConfig.sslPrivateKeyFile), // use let's encrypt to get SSL
    cert: readFileSync(generalConfig.sslCertPath + "/" + generalConfig.sslCertFile), // use let's encrypt to get SSL
    passphrase: generalConfig.sslPrivateKeyPassPhrase,
});

let players = {};
let newPlayerID = 0;

const io = new Server(httpServer, {
    cors: {
        origin: "https://" + generalConfig.clientHostDomainName,
    }
});

let serverRunning = false;
let playerUpdatePollingDelay = 0;
let mapUpdatePollingDelay = 0;
let inputUpdatePollingDelay = 0;
let playerScale = 1;
let realWorldScale = 0.00761461306 / playerScale; // meters per pixel
let accessLevels = {};
let accessLevelsIds = [];
let FPS = 60;
let frameTickTime = 1000 / FPS;
let frames = 0;
let mapData = [];
let SETTINGS = {}
let gridSize;
let mapSize = {};
let winCenterX = {};
let winCenterY = {};
let zoom = {};
let lastFrameTime = misc.now();
let walls = [];
let mouse = {};
let playerAngle = {};
sql.qry(serverSQLPool, "select * from `access_levels` order by `level`", [], function (data) {

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
            body = bodyA;
        } else {
            id = idB;
            body = bodyB;
        }
        //dump(body.objectID);
    }
    if (bodyA.object === "player" && bodyB.object === "player")
    {
        io.emit("playerImpact", players);
    }
});

httpServer.listen(socketIOPort, socketIOHost, async function() {
    dump(`Socket.IO server running at https://${socketIOHost}:${socketIOPort}`);
    serverRunning = true;
    sql.qry(serverSQLPool, "UPDATE `user_auth` SET `online` = 'N', `open_instances` = 0", [], function() {});

    SETTINGS = await settings.qrySettings();
    playerScale = parseFloat(SETTINGS.playerScale);
    gridSize = parseInt(parseInt(SETTINGS.gridSize) * playerScale);
    realWorldScale = 0.00761461306 / playerScale; // meters per pixel
    mapSize = {
        x: parseInt(SETTINGS.mapWidth),
        y: parseInt(SETTINGS.mapHeight),
    };
    playerUpdatePollingDelay = SETTINGS.playerUpdatePollingDelay;
    mapUpdatePollingDelay = SETTINGS.mapUpdatePollingDelay;
    inputUpdatePollingDelay = SETTINGS.inputUpdatePollingDelay;

    /*
    let genMapData = await map.generateMap(mapSize.x, mapSize.y);
    let ins = "INSERT INTO `map` (`id`, `chunkPosX`, `chunkPosY`, `tile`) VALUES ";
    let qry = [];
    for (let k in genMapData)
    {
        qry.push("("+genMapData[k].id+", "+genMapData[k].chunkPosX+", "+genMapData[k].chunkPosY+", '"+genMapData[k].tile+"')");
    }
    */
    //dump(ins+"\n"+qry.join(",\n"));
    //sql.qry(serverSQLPool, ins+qry.join(","), [], function(data) {
    //dump(data);
    //});
});

io.on("connection", (socket) => {
    let uuid = misc.sha256(socket.id);
    dump("User "+uuid+" connected.");
    socket.on('disconnect', () => {
        dump("User "+uuid+" disconnected.");
        let data = misc.filterObj2(players, "uuid", uuid);
        dump(data);
        if (misc.objLength(data) > 0)
        {
            let playerID = data.playerID;
            physics.deletePlayerBody(playerID);
            delete players[playerID];
            delete mapData[playerID];
            delete mouse[playerID];
            delete playerAngle[playerID];
            delete zoom[playerID];
            delete winCenterX[playerID];
            delete winCenterY[playerID];
            physics.deleteRayCast(playerID);
            io.emit("userDisconnect", {
                players: players,
                playerID: playerID,
            });
            sql.qry(serverSQLPool, "update `user_auth` set `last_ping` = ?, `online` = 'N' where `user_id` = ?", [misc.time(), data.authUserID], function() {});
            sql.qry(serverSQLPool, "update `user_auth` set `open_instances` = `open_instances` - 1 where `user_id` = ?", [data.authUserID], function() {});
            sql.qry2(serverSQLPool, "select `open_instances` from `user_auth` where `user_id` = ?", [data.authUserID], function(result) {
                if (result < 0)
                {
                    sql.qry(serverSQLPool, "update `user_auth` set `open_instances` = 0 where `user_id` = ?", [data.authUserID], function() {});
                }
            });
        }
    });

    socket.on("clientReady", async function(data) {
        let auth = data.auth;
        //dump(data);
        let avatar = data.avatar;
        winCenterX[newPlayerID] = data.winCenterX;
        winCenterY[newPlayerID] = data.winCenterY;
        zoom[newPlayerID] = data.zoom;
        mouse[newPlayerID] = {x: data.mouse.x, y: data.mouse.y};
        playerAngle[newPlayerID] = data.playerAngle;
        sql.qry2(serverSQLPool, "select * from `user_auth` where `user_id` = ?", [auth.userID], async function(result) {
            let instances = result.open_instances;
            let access = misc.filterObj2(accessLevels, "level", auth.level);
            if (instances < access.maxInstances || access.maxInstances === -1)
            {
                let accTimer = (1 / FPS) * 1000;
                let playerData = {
                    authLevel: auth.level,
                    authUsername: auth.username,
                    authUserID: auth.userID,
                    //authIP: auth.ip,
                    authKey: auth.key,
                    avatar: avatar,
                    playerID: newPlayerID,
                    uuid: uuid,
                    turnSpeed: 720,
                    forwardsAcceleration: 2 / realWorldScale,
                    forwardsDeAcceleration: 3 / realWorldScale,
                    backwardsAcceleration: 0.9 / realWorldScale,
                    backwardsDeAcceleration: 4 / realWorldScale,
                    strafeAcceleration: 2 / realWorldScale,
                    strafeDeAcceleration: 2 / realWorldScale,
                    forwardsMaxSpeed: 1.56 / realWorldScale,
                    backwardsMaxSpeed: 1 / realWorldScale,
                    strafeMaxSpeed: 1.5 / realWorldScale,
                    runBonusSpeed: 1,
                    runMinBonusSpeed: 1,
                    runMaxBonusSpeed: 2.35,
                    runBonusSpeedIncMulti: 1.01,
                    currentSpeed: 0,
                    forwardsSpeed: 0,
                    backwardsSpeed: 0,
                    strafeLeftSpeed: 0,
                    strafeRightSpeed: 0,
                    accelerationNextThink: misc.now() + accTimer,
                    momentumDir: 0,
                    forwards: false,
                    backwards: false,
                    strafeLeft: false,
                    strafeRight: false,
                    isRunning: false,
                    isTipToe: false,
                    stopPlayerTurn: false,
                    mouse: mouse[newPlayerID],
                };
                let pos = {x: 0, y: 0};
                physics.newPlayerBody(newPlayerID, pos, data.player.width, data.player.height);
                playerData.body = {
                    position: [physics.player.body[newPlayerID].position[0], physics.player.body[newPlayerID].position[1]],
                    velocity: [0, 0],
                    angle: physics.player.body[newPlayerID].angle,
                    angularVelocity: physics.player.body[newPlayerID].angularVelocity,
                };
                playerData.chunkPos = misc.calcChunkPos(playerData.body.position, gridSize);
                players[newPlayerID] = playerData;
                sql.qry(serverSQLPool, "update `user_auth` set `last_ping` = ?, `online` = 'Y' where `user_id` = ?", [misc.time(), auth.userID], function() {});
                sql.qry(serverSQLPool, "update `user_auth` set `open_instances` = `open_instances` + 1 where `user_id` = ?", [auth.userID], function() {});
                let maxChunkLoadX = Math.ceil(((winCenterX * zoom) - (gridSize / 2)) / gridSize) + 1;
                let maxChunkLoadY = Math.ceil(((winCenterY * zoom) - (gridSize / 2)) / gridSize) + 1;
                //dump(data.auth);
                mapData[newPlayerID] = await map.loadMapData({x: players[newPlayerID].chunkPos[0], y: players[newPlayerID].chunkPos[1]}, {x: maxChunkLoadX, y: maxChunkLoadY});
                for (let i in mapData[newPlayerID])
                {
                    let pos = {x: mapData[newPlayerID][i].chunkPosX, y: mapData[newPlayerID][i].chunkPosY};
                    let shadowData = map.calcShadow(pos, mapData[newPlayerID]);
                    mapData[newPlayerID][i].shadow = shadowData.shadow;
                    mapData[newPlayerID][i].shadowRotation = shadowData.rotation;
                }
                dump("New Player: "+newPlayerID);

                engine.updatePlayerPos(players, newPlayerID, FPS, gridSize, mapData);

                io.emit("newPlayer", {
                    playerData: playerData,
                    players: players,
                    newPlayerID: newPlayerID,
                    mapData: mapData[newPlayerID],
                });
                newPlayerID++;
                //dump(misc.now() - startTime);
            } else {
                io.emit("maxInstances", uuid);
            }
        });
    });

    socket.on('updatePos', async function(msg) {
        let func = msg.func;
        let id = msg.id;
        if (misc.isDefined(players[id]))
        {
            let inputUpdatePollingFrames = parseInt((inputUpdatePollingDelay / frameTickTime).toFixed(0));
            if (inputUpdatePollingFrames === 0)
                inputUpdatePollingFrames = 1;
            if (frames % inputUpdatePollingFrames === 0)
            {
                sql.qry(serverSQLPool, "update `user_auth` set `last_ping` = ?, `online` = 'Y' where `user_id` = ?", [misc.time(), players[id].authUserID], function() {});
                if (func === "run")
                {
                    if (players[id].isTipToe)
                        players[id].isTipToe = false;
                    players[id].isRunning = true;
                }
                if (func === "runStop")
                {
                    players[id].isRunning = false;
                }
                if (func === "tipToe")
                {
                    if (players[id].isRunning)
                        players[id].isRunning = false;
                    players[id].isTipToe = true;
                }
                if (func === "tipToeStop")
                {
                    players[id].isTipToe = false;
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
        }
    });

    socket.on('updateServer', async function(msg) {  // MAIN LOOP
        let id = msg.id;
        mouse[id] = {x: msg.mouse.x, y: msg.mouse.y};
        playerAngle[id] = msg.playerAngle;
        FPS = 60;//msg.fps;
        frameTickTime = 1000 / FPS;//msg.frameTickTime;
        zoom[id] = msg.worldZoom;
        winCenterX[id] = msg.winCenterX;
        winCenterY[id] = msg.winCenterY;
    });

    socket.on('deRenderMap', function(data) {
        let deRenderTile = data.deRenderTile;
        let id = parseInt(data.playerID);
        for (let i in deRenderTile)
        {
            if (misc.isDefined(mapData[id][deRenderTile[i]]))
            {
                /* FIX RAYSCAN FOV
                only delete wallbody if no player in range
                */
                let deRenderedID = deRenderTile[i];
                mapData[id][deRenderTile[i]].chunkLoaded = false;
                mapData[id][deRenderTile[i]].chunkRendered = false;
                mapData[id][deRenderTile[i]].bodyID = false;
                if (misc.isDefined(physics.wall.body[deRenderedID]))
                {
                    //physics.deleteWallBody(deRenderedID);
                }
            }
        }
    });

});

async function loopWorld()
{
    if (misc.isDefined(players))
    {
        let newMapData = [];
        for (let id in players)
        {
            //misc.dump(players[id]);
            let mapGenData = false;
            let mapDataSent;
            if (misc.isDefined(players[id]))
            {
                //dump(mouse);
                players[id].mouse = mouse[id];
                let pos = {x: physics.player.body[id].position[0], y: physics.player.body[id].position[1]};
                let mouseAngle = misc.angle(pos, mouse[id]);
                let angleDist = misc.angleDist(mouseAngle, physics.player.body[id].angle);
                let turnDir = misc.angleMoveDir(mouseAngle, physics.player.body[id].angle);
                if (misc.toDeg(angleDist) > players[id].turnSpeed / FPS)
                {
                    physics.player.body[id].angularVelocity = misc.toRad(players[id].turnSpeed) * turnDir;
                } else {
                    physics.player.body[id].angularVelocity = 0;
                    physics.player.body[id].angle = mouseAngle;
                }
                let maxChunkLoadX = Math.ceil(((winCenterX[id] * 1) - (gridSize / 2)) / gridSize) + 2;
                let maxChunkLoadY = Math.ceil(((winCenterY[id] * 1) - (gridSize / 2)) / gridSize) + 2;
                let playerChunkPos = {x: players[id].chunkPos[0], y: players[id].chunkPos[1]};
                mapData[id] = await map.loadMapData(playerChunkPos, {x: maxChunkLoadX, y: maxChunkLoadY});
                for (let sy = -maxChunkLoadY; sy <= maxChunkLoadY; sy++)
                {
                    for (let sx = -maxChunkLoadX; sx <= maxChunkLoadX; sx++)
                    {
                        let x = playerChunkPos.x + sx;
                        let y = playerChunkPos.y + sy;
                        let pos = {x: x, y: y};
                        let index = misc.getXYKey(pos);
                        if (misc.isDefined(mapData[id][index]))
                        {
                            mapData[id][index].chunkLoaded = true;
                            let northWall = false;
                            let northPos = {x: pos.x, y: pos.y + 1};
                            let northXYKey = misc.getXYKey(northPos);
                            let southWall = false;
                            let southPos = {x: pos.x, y: pos.y - 1};
                            let southXYKey = misc.getXYKey(southPos);
                            let eastWall = false;
                            let eastPos = {x: pos.x + 1, y: pos.y};
                            let eastXYKey = misc.getXYKey(eastPos);
                            let westWall = false;
                            let westPos = {x: pos.x - 1, y: pos.y};
                            let westXYKey = misc.getXYKey(westPos);
                            if (misc.isDefined(mapData[id][northXYKey]) && mapData[id][northXYKey].tile === "wall")
                                northWall = true;
                            if (misc.isDefined(mapData[id][southXYKey]) && mapData[id][southXYKey].tile === "wall")
                                southWall = true;
                            if (misc.isDefined(mapData[id][eastXYKey]) && mapData[id][eastXYKey].tile === "wall")
                                eastWall = true;
                            if (misc.isDefined(mapData[id][westXYKey]) && mapData[id][westXYKey].tile === "wall")
                                westWall = true;

                            if (mapData[id][index].tile === "floor" && northWall && southWall && eastWall && westWall)
                            {
                                mapData[id][index].tile = "wall";
                                sql.qry(serverSQLPool, "UPDATE `map` SET `tile` = 'wall' WHERE `xyKey` = ?", [index], function () {});
                            }

                            if (mapData[id][index].tile === "wall")
                            {
                                let wallBody = misc.calcGlobalPos({x: mapData[id][index].chunkPosX, y: mapData[id][index].chunkPosY}, gridSize);
                                mapData[id][index].bodyID = index;
                                physics.newWallBody(index, wallBody, gridSize, gridSize);
                                if (index === "p0_p0")
                                {
                                    //dump("wall");
                                }
                            } else {
                                if (index === "p0_p0")
                                {
                                    //dump("floor");
                                }
                                physics.deleteWallBody(index);
                            }
                        } else {
                            let radius = {x: 0, y: 0};
                            let pos = {x: x, y: y};
                            let gen = await map.generateMap(pos, mapData[id], radius, gridSize);
                            mapGenData = gen.mapData;
                        }
                    }
                }
                mapDataSent = mapData[id];
                if (mapGenData !== false)
                {
                    mapDataSent = {
                        ...mapData[id],
                        ...mapGenData,
                    };
                }

                for (let i in mapDataSent)
                {
                    let pos = {x: mapDataSent[i].chunkPosX, y: mapDataSent[i].chunkPosY};
                    let shadowData = map.calcShadow(pos, mapDataSent);
                    mapDataSent[i].shadow = shadowData.shadow;
                    mapDataSent[i].shadowRotation = shadowData.rotation;
                }
                newMapData[id] = mapDataSent;
                let playerUpdatePollingFrames = parseInt((playerUpdatePollingDelay / frameTickTime).toFixed(0));
                if (playerUpdatePollingFrames === 0)
                    playerUpdatePollingFrames = 1;
                let mapUpdatePollingFrames = parseInt((mapUpdatePollingDelay / frameTickTime).toFixed(0));
                if (mapUpdatePollingFrames === 0)
                    mapUpdatePollingFrames = 1;
                if (frames % playerUpdatePollingFrames === 0)
                {
                    io.emit("clientPlayerUpdate", {
                        players: players,
                    });
                }
                if (frames % mapUpdatePollingFrames === 0)
                {
                    io.emit("clientMapUpdate", {
                        mapData: newMapData[id],
                    });
                }
            }
        }
    }
    lastFrameTime = misc.now();
}

setImmediate(gameLoop);

function gameLoop() {
    //dump(misc.rng(0,100));
    engine.updatePlayersPos(players, FPS, gridSize, mapData);
    loopWorld();
    physics.world.step(1 / FPS, frameTickTime / 1000, 2);
    frames++;
    setTimeout(function () {
        setImmediate(gameLoop);
    }, frameTickTime);
}

function dump(input)
{
    console.log(input);
    //io.emit("serverDump", stringy.stringify(input));
}
