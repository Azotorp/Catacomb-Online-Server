const misc = require("./misc.js");
const sql = require("./sql.js");
const settings = require("./settings.js");
const physics = require("./physics.js");
const engine = require("./engine.js");
const map = require("./map.js");
const serverSQLPool = sql.serverSQLConnect();

let SETTINGS = {};

async function newPlayer(io, uuid, playerData, clientReadyData)
{
    let access = await settings.getAccessLevels();
    SETTINGS = await settings.getSettings();
    let clientData = playerData.clientData;
    let mapData = playerData.mapData;
    let players = playerData.players;
    let newPlayerID = playerData.playerIDs[uuid];
    let auth = clientReadyData.auth;
    let avatar = clientReadyData.avatar;
    clientData.winCenterX[newPlayerID] = clientReadyData.winCenterX;
    clientData.winCenterY[newPlayerID] = clientReadyData.winCenterY;
    clientData.zoom[newPlayerID] = clientReadyData.zoom;
    clientData.mouse[newPlayerID] = {x: clientReadyData.mouse.x, y: clientReadyData.mouse.y};
    clientData.playerAngle[newPlayerID] = clientReadyData.playerAngle;
    clientData.fps[newPlayerID] = clientReadyData.fps;
    clientData.frameTickTime[newPlayerID] = clientReadyData.frameTickTime;
    clientData.uuid[newPlayerID] = uuid;
    let physicsLoopFrequency = parseInt(SETTINGS.physicsLoopFrequency);
    let physicsLoopFrameTickTime = 1000 / physicsLoopFrequency;
    let playerScale = parseFloat(SETTINGS.playerScale);
    let worldScaleConstant = parseFloat(SETTINGS.worldScaleConstant);
    let realWorldScale = worldScaleConstant / playerScale; // meters per pixel
    let gridSize = parseInt(parseInt(SETTINGS.gridSize) * playerScale);
    return new Promise((resolve, reject) => {
        sql.qry2(serverSQLPool, "select * from `user_auth` where `user_id` = ?", [auth.userID], async function(result) {
            let instances = result.open_instances;
            let accessLevel = misc.filterObj2(access.levels, "level", auth.level);
            if (instances < accessLevel.maxInstances || accessLevel.maxInstances === -1)
            {
                let newPlayerData = {
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
                    momentumDir: 0,
                    forwards: false,
                    backwards: false,
                    strafeLeft: false,
                    strafeRight: false,
                    isRunning: false,
                    isTipToe: false,
                    stopPlayerTurn: false,
                    mouse: clientData.mouse[newPlayerID],
                };
                let pos = {x: 0, y: 0};
                physics.newPlayerBody(newPlayerID, pos, clientReadyData.player.width, clientReadyData.player.height);
                newPlayerData.body = {
                    position: [physics.player.body[newPlayerID].position[0], physics.player.body[newPlayerID].position[1]],
                    velocity: [0, 0],
                    angle: physics.player.body[newPlayerID].angle,
                    angularVelocity: physics.player.body[newPlayerID].angularVelocity,
                };
                newPlayerData.chunkPos = misc.calcChunkPos(newPlayerData.body.position, gridSize);
                players[newPlayerID] = newPlayerData;
                sql.qry(serverSQLPool, "update `user_auth` set `last_ping` = ?, `online` = 'Y' where `user_id` = ?", [misc.time(), auth.userID], function() {});
                sql.qry(serverSQLPool, "update `user_auth` set `open_instances` = `open_instances` + 1 where `user_id` = ?", [auth.userID], function() {});
                let maxChunkLoadX = Math.ceil(((clientData.winCenterX[newPlayerID] * 1) - (gridSize / 2)) / gridSize) + 1;
                let maxChunkLoadY = Math.ceil(((clientData.winCenterY[newPlayerID] * 1) - (gridSize / 2)) / gridSize) + 1;
                mapData[newPlayerID] = await map.loadMapData({x: players[newPlayerID].chunkPos[0], y: players[newPlayerID].chunkPos[1]}, {x: maxChunkLoadX, y: maxChunkLoadY});
                for (let id in mapData[newPlayerID])
                {
                    let pos = {x: mapData[newPlayerID][id].chunkPosX, y: mapData[newPlayerID][id].chunkPosY};
                    let shadowData = map.calcShadow(pos, mapData[newPlayerID]);
                    mapData[newPlayerID][id].shadow = shadowData.shadow;
                    mapData[newPlayerID][id].shadowRotation = shadowData.rotation;
                }
                misc.dump("New Player: "+newPlayerID);

                engine.updatePlayerPos(players, newPlayerID, physicsLoopFrequency, gridSize, mapData[newPlayerID]);

                io.emit("newPlayer", {
                    players: players,
                    mapData: mapData[newPlayerID],
                    newPlayerID: newPlayerID,
                });

                resolve({
                    playerIDs: playerData.playerIDs,
                    players: players,
                    mapData: mapData,
                    clientData: clientData,
                });
            } else {
                io.emit("maxInstances", uuid);
                resolve(false);
            }
        });
    });
}

function deletePlayer(io, playerData, playerID)
{
    let player = playerData.players[playerID];
    delete playerData.players[playerID];
    delete playerData.mapData[playerID];
    delete playerData.playerIDs[playerData.clientData.uuid[playerID]];
    delete playerData.clientData.uuid[playerID];
    delete playerData.clientData.frameTickTime[playerID];
    delete playerData.clientData.playerAngle[playerID];
    delete playerData.clientData.mouse[playerID];
    delete playerData.clientData.winCenterX[playerID];
    delete playerData.clientData.winCenterY[playerID];
    delete playerData.clientData.fps[playerID];
    delete playerData.clientData.zoom[playerID];
    physics.deletePlayerBody(playerID);
    physics.deleteRayCast(playerID);
    io.emit("userDisconnect", {
        players: playerData.players,
        playerID: playerID,
    });
    sql.qry(serverSQLPool, "update `user_auth` set `last_ping` = ?, `online` = 'N' where `user_id` = ?", [misc.time(), player.authUserID], function() {});
    sql.qry(serverSQLPool, "update `user_auth` set `open_instances` = `open_instances` - 1 where `user_id` = ?", [player.authUserID], function() {});
    sql.qry2(serverSQLPool, "select `open_instances` from `user_auth` where `user_id` = ?", [player.authUserID], function(result) {
        if (result < 0)
        {
            sql.qry(serverSQLPool, "update `user_auth` set `open_instances` = 0 where `user_id` = ?", [data.authUserID], function() {});
        }
    });
}

module.exports = {
    newPlayer: newPlayer,
    deletePlayer: deletePlayer,
};