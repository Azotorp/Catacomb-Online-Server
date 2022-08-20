const misc = require("./misc.js");
const physics = require("./physics.js");

function updatePlayerPos(players, id, FPS, gridSize)
{
    if (!misc.isDefined(players))
        return;
    let accTimer = (1 / FPS) * 1000;
    let deAccTimer = (1 / FPS) * 1000;
    if (players[id].forwards && players.hasOwnProperty(id))
    {
        if (misc.now() > players[id].accelerationNextThink)
        {
            players[id].accelerationNextThink = misc.now() + accTimer;
            let runBonus = 1;
            if (players[id].isRunning)
                runBonus = players[id].runBonusSpeed;
            players[id].forwardsSpeed += players[id].forwardsAcceleration * runBonus;
            if (players[id].forwardsSpeed > players[id].forwardsMaxSpeed * runBonus)
                players[id].forwardsSpeed = players[id].forwardsMaxSpeed * runBonus;
        }
        players[id].momentumDir = physics.playerBody[id].angle;
    } else {
        players[id].forwardsSpeed -= players[id].forwardsDeAcceleration;
        if (players[id].forwardsSpeed < 0)
            players[id].forwardsSpeed = 0;
    }

    if (players[id].backwards)
    {
        if (misc.now() > players[id].accelerationNextThink)
        {
            players[id].accelerationNextThink = misc.now() + accTimer;
            players[id].backwardsSpeed += players[id].backwardsAcceleration;
            if (players[id].backwardsSpeed > players[id].backwardsMaxSpeed)
                players[id].backwardsSpeed = players[id].backwardsMaxSpeed;
            players[id].momentumDir = misc.convRad(physics.playerBody[id].angle + misc.toRad(180));
        }
    } else {
        players[id].backwardsSpeed -= players[id].backwardsDeAcceleration;
        if (players[id].backwardsSpeed < 0)
            players[id].backwardsSpeed = 0;
    }

    if (players[id].strafeLeft)
    {
        if (misc.now() > players[id].accelerationNextThink)
        {
            players[id].accelerationNextThink = misc.now() + accTimer;
            players[id].strafeLeftSpeed += players[id].strafeAcceleration;
            if (players[id].strafeLeftSpeed > players[id].strafeMaxSpeed)
                players[id].strafeLeftSpeed = players[id].strafeMaxSpeed;
            if (players[id].forwards)
            {
                players[id].momentumDir = misc.convRad(physics.playerBody[id].angle + misc.toRad(45));
            } else if (players[id].backwards)
            {
                players[id].momentumDir = misc.convRad(physics.playerBody[id].angle + misc.toRad(45) + misc.toRad(180));
            } else {
                players[id].momentumDir = misc.convRad(physics.playerBody[id].angle + misc.toRad(90));
            }
        }
    } else {
        players[id].strafeLeftSpeed -= players[id].strafeDeAcceleration;
        if (players[id].strafeLeftSpeed < 0)
            players[id].strafeLeftSpeed = 0;
    }

    if (players[id].strafeRight)
    {
        if (misc.now() > players[id].accelerationNextThink)
        {
            players[id].accelerationNextThink = misc.now() + accTimer;
            players[id].strafeRightSpeed += players[id].strafeAcceleration;
            if (players[id].strafeRightSpeed > players[id].strafeMaxSpeed)
                players[id].strafeRightSpeed = players[id].strafeMaxSpeed;
            if (players[id].forwards)
            {
                players[id].momentumDir = misc.convRad(physics.playerBody[id].angle - misc.toRad(45));
            } else if (players[id].backwards)
            {
                players[id].momentumDir = misc.convRad(physics.playerBody[id].angle - misc.toRad(45) + misc.toRad(180));
            } else {
                players[id].momentumDir = misc.convRad(physics.playerBody[id].angle - misc.toRad(90));
            }
        }
    } else {
        players[id].strafeRightSpeed -= players[id].strafeDeAcceleration;
        if (players[id].strafeRightSpeed < 0)
            players[id].strafeRightSpeed = 0;
    }
    players[id].currentSpeed = Math.max(players[id].forwardsSpeed, players[id].backwardsSpeed, players[id].strafeLeftSpeed, players[id].strafeRightSpeed);
    players[id].body.position = [physics.playerBody[id].position[0], physics.playerBody[id].position[1]];
    players[id].body.angle = physics.playerBody[id].angle;
    players[id].chunkPos = misc.calcChunkPos(players[id].body.position, gridSize);
    physics.playerBody[id].velocity = [Math.cos(players[id].momentumDir) * players[id].currentSpeed, Math.sin(players[id].momentumDir) * players[id].currentSpeed];
    players[id].velocity = physics.playerBody[id].velocity;
}

function updatePlayersPos(players, FPS, gridSize)
{
    if (misc.isDefined(players))
    {
        for (let id in players)
        {
            updatePlayerPos(players, id, FPS, gridSize);
        }
    }
}


module.exports = {
    updatePlayerPos: updatePlayerPos,
    updatePlayersPos: updatePlayersPos,
};