const p2 = require('p2');
const misc = require("./misc.js");
const settings = require("./settings.js");
let SETTINGS = {};

const FLAG = {
    WALL: 1,
    PLAYER: 2,
    BULLET: 4,
    BULLET_MOVEMENT: 8,
    ZOMBIE: 16,
    AMMO_CLIP: 32,
    VISION_GOGGLES: 64,
};

let physics = {
    player: {
        body: {},
        shape: {},
    },
    wall: {
        body: {},
        shape: {},
    },
    world: new p2.World({
        gravity : [0,0],
        frictionGravity: 10,
        //islandSplit : true,
    }),
    rays: {
        wallLOSRayCast: {},
        laserRayCast: {},
        lightRayCast: {},
    },
};


//physics.world.sleepMode = p2.World.ISLAND_SLEEPING;
physics.world.solver.iterations = 20;
physics.world.solver.tolerance = 0.1;
//physics.world.setGlobalStiffness(1000000000000);


function newPlayerBody(playerID, pos, width, height)
{
    physics.player.body[playerID] = new p2.Body({
        mass: 100,
        position: [pos.x, pos.y],
        angle: misc.toRad(misc.rng(0, 360)),
    });

    /*
    physics.player.body[playerID].fromPolygon(outlinePath, {skipSimpleCheck: true});
    physics.player.body[playerID].object = "player";
    physics.player.body[playerID].objectID = playerID;
    for (let s in physics.player.body[playerID].shapes)
    {
        physics.player.body[playerID].shapes[s].collisionGroup = FLAG.PLAYER;
        physics.player.body[playerID].shapes[s].collisionMask = FLAG.WALL | FLAG.BULLET | FLAG.VISION_GOGGLES | FLAG.PLAYER | FLAG.ZOMBIE | FLAG.AMMO_CLIP;;
    }
    */

    physics.player.shape[playerID] = new p2.Box({
        width: width,
        height: height,
    });
    physics.player.shape[playerID].anchorRatio = {x: 0.237983, y: 0.547403};
    physics.player.shape[playerID].collisionGroup = FLAG.PLAYER;
    physics.player.shape[playerID].collisionMask = FLAG.WALL | FLAG.BULLET | FLAG.VISION_GOGGLES | FLAG.PLAYER | FLAG.ZOMBIE | FLAG.AMMO_CLIP;
    physics.player.body[playerID].object = "player";
    physics.player.body[playerID].objectID = playerID;
    physics.player.body[playerID].damping = 0;
    physics.player.body[playerID].centerMass = {x: (width / 2) - (width * physics.player.shape[playerID].anchorRatio.x), y: (height / 2) - (height * physics.player.shape[playerID].anchorRatio.y)};
    physics.player.body[playerID].addShape(physics.player.shape[playerID], [physics.player.body[playerID].centerMass.x, physics.player.body[playerID].centerMass.y], misc.toRad(0));
    physics.world.addBody(physics.player.body[playerID]);
}

function newWallBody(id, pos, width, height)
{
    if (!misc.isDefined(physics.wall.body[id]))
    {
        physics.wall.body[id] = new p2.Body({
            position: [pos.x, pos.y],
            angle: 0,
            type: p2.Body.STATIC,
        });
        physics.wall.shape[id] = new p2.Box({
            width: width,
            height: height,
        });
        physics.wall.shape[id].anchorRatio = {x: 0.5, y: 0.5};
        physics.wall.shape[id].collisionGroup = FLAG.WALL;
        physics.wall.shape[id].collisionMask = FLAG.BULLET | FLAG.VISION_GOGGLES | FLAG.PLAYER | FLAG.ZOMBIE | FLAG.AMMO_CLIP;
        physics.wall.body[id].object = "wall";
        physics.wall.body[id].objectID = id;
        physics.wall.body[id].damping = 0;
        physics.wall.body[id].centerMass = {x: (width / 2) - (width * physics.wall.shape[id].anchorRatio.x), y: (height / 2) - (height * physics.wall.shape[id].anchorRatio.y)};
        physics.wall.body[id].addShape(physics.wall.shape[id], [physics.wall.body[id].centerMass.x, physics.wall.body[id].centerMass.y], misc.toRad(0));
        physics.world.addBody(physics.wall.body[id]);
    }
}


function deleteWallBody(id)
{
    if (misc.isDefined(physics.wall.body[id]))
    {
        physics.world.removeBody(physics.wall.body[id]);
        delete physics.wall.body[id];
        delete physics.wall.shape[id];
    }
}

function deletePlayerBody(id)
{
    if (misc.isDefined(physics.player.body[id]))
    {
        physics.world.removeBody(physics.player.body[id]);
        delete physics.player.body[id];
        delete physics.player.shape[id];
    }
}

function clearAllWallBodies()
{
    if (misc.isDefined(physics.wall.body))
    {
        for (let id in physics.wall.body)
        {
            if (misc.isDefined(physics.wall.body[id])) {
                physics.world.removeBody(physics.wall.body[id]);
                delete physics.wall.body[id];
                delete physics.wall.shape[id];
            }
        }
    }
}

function rayCast(object, origin, endPos, collisionMask = null, reverse = true, skipBackTraces = true)
{
    object = {
        result: new p2.RaycastResult(),
        hitPoint: p2.vec2.create(),
        rayClosest: new p2.Ray({
            mode: p2.Ray.CLOSEST,
            collisionMask: collisionMask,
            skipBackfaces: skipBackTraces,
        }),
    };
    p2.vec2.copy(object.rayClosest.from, [origin.x, origin.y]);
    p2.vec2.copy(object.rayClosest.to, [endPos.x, endPos.y]);
    object.rayClosest.update();
    physics.world.raycast(object.result, object.rayClosest);
    object.result.getHitPoint(object.hitPoint, object.rayClosest);
    //object.result.reset();
    let dir = 1;
    if (reverse)
        dir = -1;
    let body = {
        object: false,
        objectID: false,
    };
    if (object.result.body !== null)
    {
        body = {
            object: object.result.body.object,
            objectID: object.result.body.objectID,
        };
        return {
            x: object.hitPoint[0],
            y: object.hitPoint[1] * dir,
            body: body,
        };
    } else {
        return {
            x: endPos.x,
            y: endPos.y * dir,
            body: body,
        };
    }
}

function deleteRayCast(object, id)
{
    delete object;
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
    wall: physics.wall,
    player: physics.player,
    world: physics.world,
    FLAG: FLAG,
    rays: physics.rays,
    newPlayerBody: newPlayerBody,
    newWallBody: newWallBody,
    deleteWallBody: deleteWallBody,
    deletePlayerBody: deletePlayerBody,
    clearAllWallBodies: clearAllWallBodies,
    rayCast: rayCast,
    deleteRayCast: deleteRayCast,
    loadSettings: loadSettings,
};