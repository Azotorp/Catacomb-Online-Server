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
const player = require("./modules/player.js");
const zombie = require("./modules/zombie.js");
const stringy = require("./modules/circular.js");
const settings = require("./modules/settings.js");
const serverSQLPool = sql.serverSQLConnect();
const httpServer = createServer({
    key: readFileSync(generalConfig.sslPrivateKeyPath + "/" + generalConfig.sslPrivateKeyFile), // use let's encrypt to get SSL
    cert: readFileSync(generalConfig.sslCertPath + "/" + generalConfig.sslCertFile), // use let's encrypt to get SSL
    passphrase: generalConfig.sslPrivateKeyPassPhrase,
});

const io = new Server(httpServer, {
    cors: {
        origin: "https://" + generalConfig.clientHostDomainName,
    }
});

let playerData = {
    playerIDs: {},
    players: {},
    mapData: {},
    clientData: {
        winCenterX: {},
        winCenterY: {},
        zoom: {},
        mouse: {},
        playerAngle: {},
        fps: {},
        frameTickTime: {},
        uuid: {},
    },
};

let zombies = {};
let newZombieID = 0;

let serverRunning = false;
let playerUpdatePollingDelay = 0;
let mapUpdatePollingDelay = 0;
let inputUpdatePollingDelay = 0;
let playerScale = 1;
let worldScaleConstant = 0.00761461306;
let realWorldScale = worldScaleConstant / playerScale; // meters per pixel
let physicsLoopFrequency = 66;
let physicsLoopFrameTickTime = 1000 / physicsLoopFrequency;
let frames = 0;
let SETTINGS = {};
let gridSize;
let mapSize = {};
let lastFrameTime = misc.now();
let walls = [];

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
        io.emit("playerImpact", playerData.players);
    }
});

httpServer.listen(socketIOPort, socketIOHost, async function() {
    dump(`Socket.IO server running at https://${socketIOHost}:${socketIOPort}`);
    serverRunning = true;
    sql.qry(serverSQLPool, "UPDATE `user_auth` SET `online` = 'N', `open_instances` = 0", [], function() {});

    SETTINGS = await settings.getSettings();
    physicsLoopFrequency = parseInt(SETTINGS.physicsLoopFrequency);
    physicsLoopFrameTickTime = 1000 / physicsLoopFrequency;
    playerScale = parseFloat(SETTINGS.playerScale);
    gridSize = parseInt(parseInt(SETTINGS.gridSize) * playerScale);
    worldScaleConstant = parseFloat(SETTINGS.worldScaleConstant);
    realWorldScale = worldScaleConstant / playerScale; // meters per pixel
    mapSize = {
        x: parseInt(SETTINGS.mapWidth),
        y: parseInt(SETTINGS.mapHeight),
    };
    playerUpdatePollingDelay = SETTINGS.playerUpdatePollingDelay;
    mapUpdatePollingDelay = SETTINGS.mapUpdatePollingDelay;
    inputUpdatePollingDelay = SETTINGS.inputUpdatePollingDelay;
    //map.breakDeadEnds();
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
    let uniqueID = false;
    while (!uniqueID)
    {
        let id = "" + misc.genNewID(10, {upper: false, lower: true, numbers: false, symbols: false});
        if (Object.values(playerData.playerIDs).indexOf(id) === -1)
        {
            playerData.playerIDs[uuid] = id;
            uniqueID = true;
            break;
        }
    }
    let playerID = playerData.playerIDs[uuid];
    dump("User " + playerID + " connected.");
    socket.on('disconnect', () => {
        dump("User " + playerID + " disconnected.");
        player.deletePlayer(io, playerData, playerID);
    });

    socket.on("clientReady", async function(clientReadyData) {
        let newData = await player.newPlayer(io, uuid, playerData, clientReadyData);
        playerData = {
            playerIDs: newData.playerIDs,
            players: newData.players,
            mapData: newData.mapData,
            clientData: newData.clientData,
        };
    });

    socket.on("changeMap", async function(data) {
        let id = data.playerID;
        let changeTo = data.changeTo;
        let xyKey = data.xyKey;
        let playerFound = false;
        let pos = misc.getXYPos(xyKey);
        for (let p in playerData.players)
        {
            if (pos.x === playerData.players[p].chunkPos[0] && pos.y === playerData.players[p].chunkPos[1])
            {
                playerFound = true;
            }
        }
        if (misc.isDefined(playerData.mapData[id][xyKey]) && !playerFound)
        {
            if (changeTo === "wall" || changeTo === "floor")
            {
                let userID = playerData.players[id].authUserID;
                sql.qry(serverSQLPool, "UPDATE `map` SET `tile` = ?, `changedBy` = ? WHERE `xyKey` = ?", [changeTo, userID, xyKey], function () {});
                playerData.mapData[id][xyKey].tile = changeTo;
            }
        }
    });

    socket.on('updatePos', async function(msg) {
        let func = msg.func;
        let id = msg.id;
        if (misc.isDefined(playerData.players[id]))
        {
            let inputUpdatePollingFrames = parseInt((inputUpdatePollingDelay / physicsLoopFrameTickTime).toFixed(0));
            if (inputUpdatePollingFrames === 0)
                inputUpdatePollingFrames = 1;
            if (frames % inputUpdatePollingFrames === 0)
            {
                sql.qry(serverSQLPool, "update `user_auth` set `last_ping` = ?, `online` = 'Y' where `user_id` = ?", [misc.time(), playerData.players[id].authUserID], function() {});
                if (func === "run")
                {
                    if (playerData.players[id].isTipToe)
                        playerData.players[id].isTipToe = false;
                    playerData.players[id].isRunning = true;
                }
                if (func === "runStop")
                {
                    playerData.players[id].isRunning = false;
                }
                if (func === "tipToe")
                {
                    if (playerData.players[id].isRunning)
                        playerData.players[id].isRunning = false;
                    playerData.players[id].isTipToe = true;
                }
                if (func === "tipToeStop")
                {
                    playerData.players[id].isTipToe = false;
                }
                if (func === "upStop")
                {
                    playerData.players[id].forwards = false;
                    playerData.players[id].backwards = false;
                }
                if (func === "downStop")
                {
                    playerData.players[id].forwards = false;
                    playerData.players[id].backwards = false;
                }
                if (func === "leftStop")
                {
                    playerData.players[id].strafeLeft = false;
                }
                if (func === "rightStop")
                {
                    playerData.players[id].strafeRight = false;
                }
                if (func === "up")
                {
                    playerData.players[id].forwards = true;
                    playerData.players[id].backwards = false;
                }
                if (func === "down")
                {
                    playerData.players[id].forwards = false;
                    playerData.players[id].backwards = true;
                }
                if (func === "left")
                {
                    playerData.players[id].strafeLeft = true;
                    playerData.players[id].strafeRight = false;
                }
                if (func === "right")
                {
                    playerData.players[id].strafeLeft = false;
                    playerData.players[id].strafeRight = true;
                }
            }
        }
    });

    socket.on('updateServer', async function(msg) {  // MAIN LOOP
        let id = msg.id;
        playerData.clientData.mouse[id] = {x: msg.mouse.x, y: msg.mouse.y};
        playerData.clientData.playerAngle[id] = msg.playerAngle;
        playerData.clientData.fps[id] = msg.fps;
        playerData.clientData.frameTickTime[id] = msg.frameTickTime;
        playerData.clientData.zoom[id] = msg.worldZoom;
        playerData.clientData.winCenterX[id] = msg.winCenterX;
        playerData.clientData.winCenterY[id] = msg.winCenterY;
    });

    socket.on('deRenderMap', function(data) {
        let deRenderTile = data.deRenderTile;
        let id = data.playerID;
        for (let i in deRenderTile)
        {
            if (misc.isDefined(playerData.mapData[id][deRenderTile[i]]))
            {
                /* FIX RAYSCAN FOV
                only delete wallbody if no player in range
                */
                let deRenderedID = deRenderTile[i];
                playerData.mapData[id][deRenderTile[i]].chunkLoaded = false;
                playerData.mapData[id][deRenderTile[i]].chunkRendered = false;
                playerData.mapData[id][deRenderTile[i]].bodyID = false;
                if (misc.isDefined(physics.wall.body[deRenderedID]))
                {
                    //physics.deleteWallBody(deRenderedID);
                }
            }
        }
    });

    socket.on("ping", function (data) {
        let timestamp = Date.now() / 1000;
        let timeDiff = (timestamp - data.timestamp) * 1000;
        io.emit("ping", {
            serverTimestamp: timestamp,
            clientTimestamp: data.timestamp,
            timeDiff: timeDiff,
            log: data.log,
        });
    });

});

async function loopWorld()
{
    if (misc.isDefined(playerData.players))
    {
        let newMapData = [];
        for (let id in playerData.players)
        {
            //misc.dump(playerData.players[id]);
            let mapGenData = false;
            let mapDataSent;
            if (misc.isDefined(playerData.players[id]))
            {
                //dump(mouse);
                playerData.players[id].mouse = playerData.clientData.mouse[id];
                let pos = {x: physics.player.body[id].position[0], y: physics.player.body[id].position[1]};
                let mouseAngle = misc.angle(pos, playerData.clientData.mouse[id]);
                let angleDist = misc.angleDist(mouseAngle, physics.player.body[id].angle);
                let turnDir = misc.angleMoveDir(mouseAngle, physics.player.body[id].angle);
                if (misc.toDeg(angleDist) > playerData.players[id].turnSpeed / physicsLoopFrequency)
                {
                    physics.player.body[id].angularVelocity = misc.toRad(playerData.players[id].turnSpeed) * turnDir;
                } else {
                    physics.player.body[id].angularVelocity = 0;
                    physics.player.body[id].angle = mouseAngle;
                }
                let maxChunkLoadX = Math.ceil(((playerData.clientData.winCenterX[id] * 1) - (gridSize / 2)) / gridSize) + 2;
                let maxChunkLoadY = Math.ceil(((playerData.clientData.winCenterY[id] * 1) - (gridSize / 2)) / gridSize) + 2;
                let playerChunkPos = {x: playerData.players[id].chunkPos[0], y: playerData.players[id].chunkPos[1]};
                playerData.mapData[id] = await map.loadMapData(playerChunkPos, {x: maxChunkLoadX, y: maxChunkLoadY});
                let startPos = false;
                for (let sy = -maxChunkLoadY; sy <= maxChunkLoadY; sy++)
                {
                    for (let sx = -maxChunkLoadX; sx <= maxChunkLoadX; sx++)
                    {
                        let x = playerChunkPos.x + sx;
                        let y = playerChunkPos.y + sy;
                        let pos = {x: x, y: y};
                        let index = misc.getXYKey(pos);
                        if (index === "p0_p0")
                            startPos = true;
                        if (misc.isDefined(playerData.mapData[id][index]))
                        {
                            playerData.mapData[id][index].chunkLoaded = true;

                            let playerFound = false;
                            for (let p in playerData.players)
                            {
                                if (pos.x === playerData.players[p].chunkPos[0] && pos.y === playerData.players[p].chunkPos[1])
                                {
                                    playerFound = true;
                                }
                            }

                            if (!playerFound && !startPos)
                            {
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
                                if (misc.isDefined(playerData.mapData[id][northXYKey]) && playerData.mapData[id][northXYKey].tile === "wall")
                                    northWall = true;
                                if (misc.isDefined(playerData.mapData[id][southXYKey]) && playerData.mapData[id][southXYKey].tile === "wall")
                                    southWall = true;
                                if (misc.isDefined(playerData.mapData[id][eastXYKey]) && playerData.mapData[id][eastXYKey].tile === "wall")
                                    eastWall = true;
                                if (misc.isDefined(playerData.mapData[id][westXYKey]) && playerData.mapData[id][westXYKey].tile === "wall")
                                    westWall = true;

                                if (playerData.mapData[id][index].tile === "floor" && northWall && southWall && eastWall && westWall)
                                {
                                    playerData.mapData[id][index].tile = "wall";
                                    sql.qry(serverSQLPool, "UPDATE `map` SET `tile` = 'wall' WHERE `xyKey` = ?", [index], function () {});
                                }
                            }

                            if (playerData.mapData[id][index].tile === "wall")
                            {
                                let wallBody = misc.calcGlobalPos({x: playerData.mapData[id][index].chunkPosX, y: playerData.mapData[id][index].chunkPosY}, gridSize);
                                playerData.mapData[id][index].bodyID = index;
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
                            let gen = await map.generateMap(id, pos, playerData, radius, gridSize);
                            mapGenData = gen.mapData;
                        }
                    }
                }
                mapDataSent = playerData.mapData[id];
                if (mapGenData !== false)
                {
                    mapDataSent = {
                        ...playerData.mapData[id],
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
                let playerUpdatePollingFrames = parseInt((playerUpdatePollingDelay / physicsLoopFrameTickTime).toFixed(0));
                if (playerUpdatePollingFrames === 0)
                    playerUpdatePollingFrames = 1;
                let mapUpdatePollingFrames = parseInt((mapUpdatePollingDelay / physicsLoopFrameTickTime).toFixed(0));
                if (mapUpdatePollingFrames === 0)
                    mapUpdatePollingFrames = 1;
                if (frames % playerUpdatePollingFrames === 0)
                {
                    io.emit("clientPlayerUpdate", {
                        players: playerData.players,
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
    if (misc.isDefined(playerData.players) && misc.objLength(playerData.players, true) > 0)
    {
        engine.updatePlayersPos(playerData.players, physicsLoopFrequency, gridSize, playerData.mapData);
        loopWorld();
    }
    physics.world.step(1 / physicsLoopFrequency, physicsLoopFrameTickTime / 1000, 2);
    frames++;
    setTimeout(function () {
        setImmediate(gameLoop);
    }, physicsLoopFrameTickTime);
}

function dump(input)
{
    console.log(input);
    //io.emit("serverDump", stringy.stringify(input));
}
