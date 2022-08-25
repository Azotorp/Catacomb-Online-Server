const misc = require("./misc.js");
const physics = require("./physics.js");

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

    let origin = {
        x: players[id].body.position[0],
        y: players[id].body.position[1],
    };
    let fovScanPos = [];
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

    angle.sort((a, b) => {
        return a - b;
    });

    for (let a in angle)
    {
        let endPos = {
            x: origin.x + Math.cos(angle[a]) * 999999,
            y: origin.y + Math.sin(angle[a]) * 999999,
        };
        fovScanPos.push(physics.castFOVRay(id, origin, endPos));
    }
    players[id].fovScanPath = fovScanPos;
}

function updatePlayersPos(players, FPS, gridSize, mapData)
{
    if (misc.isDefined(players))
    {
        for (let id in players)
        {
            updatePlayerPos(players, id, FPS, gridSize, mapData);
        }
    }
}


module.exports = {
    updatePlayerPos: updatePlayerPos,
    updatePlayersPos: updatePlayersPos,
};