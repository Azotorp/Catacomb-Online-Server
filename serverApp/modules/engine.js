const misc = require("./misc.js");
const physics = require("./physics.js");
const settings = require("./settings.js");
let SETTINGS = {};

function updatePlayerPos(players, id, FPS, gridSize, mapData)
{
    if (!misc.isDefined(players))
        return;
    if (players[id].forwards)
    {
        players[id].backwardsSpeed -= players[id].backwardsAcceleration / FPS;
        if (players[id].backwardsSpeed < 0)
            players[id].backwardsSpeed = 0;
        players[id].forwardsSpeed += players[id].forwardsAcceleration / FPS;
        if (players[id].forwardsSpeed > players[id].forwardsMaxSpeed)
            players[id].forwardsSpeed = players[id].forwardsMaxSpeed;
    } else {
        players[id].forwardsSpeed -= players[id].forwardsDeAcceleration / FPS;
        if (players[id].forwardsSpeed < 0)
            players[id].forwardsSpeed = 0;
    }

    if (players[id].backwards)
    {
        players[id].forwardsSpeed -= players[id].forwardsAcceleration / FPS;
        if (players[id].forwardsSpeed < 0)
            players[id].forwardsSpeed = 0;
        players[id].backwardsSpeed += players[id].backwardsAcceleration / FPS;
        if (players[id].backwardsSpeed > players[id].backwardsMaxSpeed)
            players[id].backwardsSpeed = players[id].backwardsMaxSpeed;
    } else {
        players[id].backwardsSpeed -= players[id].backwardsDeAcceleration / FPS;
        if (players[id].backwardsSpeed < 0)
            players[id].backwardsSpeed = 0;
    }

    if (players[id].strafeLeft)
    {
        players[id].strafeRightSpeed -= players[id].strafeAcceleration / FPS;
        if (players[id].strafeRightSpeed < 0)
            players[id].strafeRightSpeed = 0;
        players[id].strafeLeftSpeed += players[id].strafeAcceleration / FPS;
        if (players[id].strafeLeftSpeed > players[id].strafeMaxSpeed)
            players[id].strafeLeftSpeed = players[id].strafeMaxSpeed;
    } else {
        players[id].strafeLeftSpeed -= players[id].strafeDeAcceleration / FPS;
        if (players[id].strafeLeftSpeed < 0)
            players[id].strafeLeftSpeed = 0;
    }

    if (players[id].strafeRight)
    {
        players[id].strafeLeftSpeed -= players[id].strafeAcceleration / FPS;
        if (players[id].strafeLeftSpeed < 0)
            players[id].strafeLeftSpeed = 0;
        players[id].strafeRightSpeed += players[id].strafeAcceleration / FPS;
        if (players[id].strafeRightSpeed > players[id].strafeMaxSpeed)
            players[id].strafeRightSpeed = players[id].strafeMaxSpeed;
    } else {
        players[id].strafeRightSpeed -= players[id].strafeDeAcceleration / FPS;
        if (players[id].strafeRightSpeed < 0)
            players[id].strafeRightSpeed = 0;
    }

    let speedVector;
    let theta;
    let vectorSpeed;
    if (players[id].forwardsSpeed > 0)
    {
        if (players[id].strafeLeftSpeed > 0)
        {
            // forwards and left
            speedVector = {x: players[id].forwardsSpeed, y: players[id].strafeLeftSpeed};
            vectorSpeed = misc.distance(speedVector);
            theta = misc.angle(speedVector);
        } else if (players[id].strafeRightSpeed > 0)
        {
            // forwards and right
            speedVector = {x: players[id].forwardsSpeed, y: -players[id].strafeRightSpeed};
            vectorSpeed = misc.distance(speedVector);
            theta = misc.angle(speedVector);
        } else {
            // forwards only
            speedVector = {x: players[id].forwardsSpeed, y: 0};
            vectorSpeed = misc.distance(speedVector);
            theta = misc.angle(speedVector);
        }
    } else if (players[id].backwardsSpeed > 0)
    {
        if (players[id].strafeLeftSpeed > 0)
        {
            // backwards and left
            speedVector = {x: -players[id].backwardsSpeed, y: players[id].strafeLeftSpeed};
            vectorSpeed = misc.distance(speedVector);
            theta = misc.angle(speedVector);
        } else if (players[id].strafeRightSpeed > 0)
        {
            // backwards and right
            speedVector = {x: -players[id].backwardsSpeed, y: -players[id].strafeRightSpeed};
            vectorSpeed = misc.distance(speedVector);
            theta = misc.angle(speedVector);
        } else {
            // backwards only
            speedVector = {x: -players[id].backwardsSpeed, y: 0};
            vectorSpeed = misc.distance(speedVector);
            theta = misc.angle(speedVector);
        }
    } else if (players[id].strafeLeftSpeed > 0)
    {
        speedVector = {x: 0, y: players[id].strafeLeftSpeed};
        vectorSpeed = misc.distance(speedVector);
        theta = misc.angle(speedVector);
    } else if (players[id].strafeRightSpeed > 0)
    {
        speedVector = {x: 0, y: -players[id].strafeRightSpeed};
        vectorSpeed = misc.distance(speedVector);
        theta = misc.angle(speedVector);
    } else {
        // standing still
        vectorSpeed = 0;
        theta = 0;
    }

    players[id].momentumDir = misc.convRad(physics.player.body[id].angle + theta);

    let runBonus = 1;
    if (players[id].isRunning)
    {
        if (players[id].forwards)
        {
            runBonus = players[id].runBonusSpeed;
            players[id].runBonusSpeed *= players[id].runBonusSpeedIncMulti;
            if (players[id].runBonusSpeed >= players[id].runMaxBonusSpeed)
                players[id].runBonusSpeed = players[id].runMaxBonusSpeed;
            if (players[id].strafeLeft || players[id].strafeRight)
            {
                runBonus = players[id].runBonusSpeed;
                players[id].runBonusSpeed *= players[id].runBonusSpeedIncMulti;
                if (players[id].runBonusSpeed >= players[id].runMaxBonusSpeed)
                    players[id].runBonusSpeed = players[id].runMaxBonusSpeed;
            }
        } else if (players[id].strafeLeft || players[id].strafeRight)
        {
            runBonus = players[id].runBonusSpeed;
            players[id].runBonusSpeed *= players[id].runBonusSpeedIncMulti;
            if (players[id].runBonusSpeed > players[id].runMaxBonusSpeed)
                players[id].runBonusSpeed = players[id].runMaxBonusSpeed;
        }
    } else if (players[id].isTipToe)
    {
        runBonus = players[id].runBonusSpeed;
        players[id].runBonusSpeed /= players[id].runBonusSpeedIncMulti;
        if (players[id].runBonusSpeed < players[id].runMinBonusSpeed / 2)
            players[id].runBonusSpeed = players[id].runMinBonusSpeed / 2;
    } else {
        runBonus = players[id].runBonusSpeed;
        if (players[id].runBonusSpeed < 1)
        {
            players[id].runBonusSpeed *= players[id].runBonusSpeedIncMulti * 2;
            if (players[id].runBonusSpeed > players[id].runMinBonusSpeed)
                players[id].runBonusSpeed = players[id].runMinBonusSpeed;
        } else if (players[id].runBonusSpeed > 1)
        {
            players[id].runBonusSpeed /= players[id].runBonusSpeedIncMulti * 2;
            if (players[id].runBonusSpeed < players[id].runMinBonusSpeed)
                players[id].runBonusSpeed = players[id].runMinBonusSpeed;
        }
    }

    players[id].currentSpeed = vectorSpeed * runBonus;
    players[id].body.position = [physics.player.body[id].position[0], physics.player.body[id].position[1]];
    players[id].body.angle = physics.player.body[id].angle;
    players[id].chunkPos = misc.calcChunkPos(players[id].body.position, gridSize);
    physics.player.body[id].velocity = [Math.cos(players[id].momentumDir) * players[id].currentSpeed, Math.sin(players[id].momentumDir) * players[id].currentSpeed];
    players[id].body.velocity = physics.player.body[id].velocity;
    players[id].body.angularVelocity = physics.player.body[id].angularVelocity;
    players[id].body.movementHistory.push({
        mouse: {
            x: players[id].mouse.x,
            y: players[id].mouse.y,
        },
        position: {
            x: players[id].body.position[0],
            y: players[id].body.position[1],
        },
        velocity: {
            x: players[id].body.velocity[0],
            y: players[id].body.velocity[1],
        },
        angle: players[id].body.angle,
        angularVelocity: players[id].body.angularVelocity,
        timestamp: Date.now() / 1000,
    });
    if (players[id].body.movementHistory.length > 10)
        players[id].body.movementHistory.shift();
}

function updatePlayersPos(players, FPS, gridSize, mapData)
{
    if (misc.isDefined(players))
    {
        for (let id in players)
        {
            updatePlayerPos(players, id, FPS, gridSize, mapData);
            wallLOSRayCast(players, mapData, id, gridSize);
            lightRayCast(60, players, mapData, id, gridSize);
        }
    }
}

function lightRayCast(fov, players, mapData, id, gridSize)
{
    let aim = players[id].body.angle;// + physics.player.body[id].angularVelocity / SETTINGS.physicsLoopFrequency;
    let origin = {
        x: players[id].body.position[0],
        y: players[id].body.position[1],
    };

    let muzzleOffset = {
        length: SETTINGS.muzzlePosOffset.x * SETTINGS.playerScale - 20,
        width: SETTINGS.muzzlePosOffset.y * SETTINGS.playerScale,
    };

    let flashLightPos = {
        x: origin.x + Math.cos(aim) * muzzleOffset.length - Math.cos(aim + misc.toRad(90)) * muzzleOffset.width,
        y: origin.y + Math.sin(aim) * muzzleOffset.length - Math.sin(aim + misc.toRad(90)) * muzzleOffset.width,
    };

    let halfFov = fov / 2;
    let lightRayCastPath = [];
    let angle = [];
    let rays = 60;
    let angleStep = fov / rays;
    for (let f = 0; f < fov; f += angleStep)
    {
        let angle3 = aim + misc.toRad(f) - (misc.toRad(fov) / 2);
        angle.push(angle3);
    }
    let angle3 = aim + misc.toRad(fov) - (misc.toRad(fov) / 2);
    angle.push(angle3);
    angle.sort((a, b) => {
        return a - b;
    });
    let range = 1050;
    for (let a in angle)
    {
        let ad = misc.toDeg(misc.angleDist(angle[a], aim));
        let rangeMod = 1;
        if (ad > fov * 0.95)
            rangeMod = 0.1;
        let endPos = {
            x: flashLightPos.x + Math.cos(angle[a]) * range * rangeMod,
            y: flashLightPos.y + Math.sin(angle[a]) * range * rangeMod,
        };
        lightRayCastPath.push(physics.rayCast(physics.rays.lightRayCast[id], flashLightPos, endPos, physics.FLAG.WALL));
    }
    players[id].lightRayCastPath = lightRayCastPath;
    players[id].lightRayCastPath.push({
        x: flashLightPos.x,
        y: -flashLightPos.y,
    });
}

function wallLOSRayCast(players, mapData, id, gridSize)
{
    let origin = {
        x: players[id].body.position[0],
        y: players[id].body.position[1],
    };

    let wallLOSRayCastPath = [];
    let angle = [];
    for (let m in mapData[id])
    {
        if (mapData[id][m].tile === "wall")
        {
            let corner = [];
            let pos = {x: mapData[id][m].chunkPosX, y: mapData[id][m].chunkPosY};
            let cornerPos = misc.calcGlobalPos(pos, gridSize);
            corner[0] = {
                x: cornerPos.x - gridSize / 2,
                y: cornerPos.y - gridSize / 2,
            };
            corner[1] = {
                x: cornerPos.x + gridSize / 2,
                y: cornerPos.y - gridSize / 2,
            };
            corner[2] = {
                x: cornerPos.x - gridSize / 2,
                y: cornerPos.y + gridSize / 2,
            };
            corner[3] = {
                x: cornerPos.x + gridSize / 2,
                y: cornerPos.y + gridSize / 2,
            };
            for (let c in corner)
            {
                let angle1 = misc.angle(origin, {x: corner[c].x - 0.1, y: corner[c].y});
                let angle2 = misc.angle(origin, {x: corner[c].x + 0.1, y: corner[c].y});
                angle.push(angle1);
                angle.push(angle2);
            }
        }
    }
    // comment

    let rays = 24;
    for (let n = 0; n < rays; n++)
    {
        let angle3 = misc.toRad(360) / rays * n ;
        angle.push(angle3);
    }

    angle.sort((a, b) => {
        return a - b;
    });

    for (let a in angle)
    {
        let endPos = {
            x: origin.x + Math.cos(angle[a]) * 9999,
            y: origin.y + Math.sin(angle[a]) * 9999,
        };
        wallLOSRayCastPath.push(physics.rayCast(physics.rays.wallLOSRayCast[id], origin, endPos, physics.FLAG.WALL));
    }
    players[id].wallLOSRayCastPath = wallLOSRayCastPath;

}

function dump(input, table = false, label = false, remoteConn = false)
{
    return misc.dump(input, table, label, remoteConn);
}

async function loadSettings()
{
    SETTINGS = await settings.getSettings();
}

module.exports = {
    updatePlayerPos: updatePlayerPos,
    updatePlayersPos: updatePlayersPos,
    loadSettings: loadSettings,
};