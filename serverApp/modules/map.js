const misc = require("./misc.js");
const sql = require("./sql.js");
const settings = require("./settings.js");
const physics = require("./physics.js");
const serverSQLPool = sql.serverSQLConnect();

async function loadMapData(pos =  {x: 0, y: 0}, radius= {x: 0, y: 0})
{
    let SETTINGS = await settings.getSettings();
    let playerScale = parseFloat(SETTINGS.playerScale);
    let gridSize = parseInt(parseInt(SETTINGS.gridSize) * playerScale);
    let tilesData = {};
    return new Promise(function(resolve, reject) {
        let sqlQry = "select * from `map`";
        let param = [];
        if (radius.x > 0 && radius.y > 0)
        {
            sqlQry += " where `chunkPosX` >= ? and `chunkPosX` <= ? and `chunkPosY` >= ? and `chunkPosY` <= ?";
            param.push(pos.x - radius.x);
            param.push(pos.x + radius.x);
            param.push(pos.y - radius.y);
            param.push(pos.y + radius.y);
        }
        //misc.dump(pos);
        //misc.dump(radius);

        sql.qry(serverSQLPool, sqlQry, param, function (data, error) {
            if (misc.objLength(data) > 0)
            {
                let tiles = data;
                for (let i in tiles)
                {
                    let id = tiles[i].id;
                    let chunkPos = {
                        x: tiles[i].chunkPosX,
                        y: tiles[i].chunkPosY,
                    };

                    tiles[i].cordId = chunkPos.x + "_" + chunkPos.y;
                    tiles[i].globalPos = misc.calcGlobalPos(chunkPos, gridSize);
                    let xyKey = misc.getXYKey(chunkPos);
                    tiles[i].xyKey = xyKey;
                    tiles[i].chunkLoaded = false;
                    tiles[i].chunkRendered = false;
                    tilesData[xyKey] = tiles[i];
                }
            }
            resolve(tilesData);
        });
    });
}

/*
async function getNewMapID()
{
    return new Promise(function(resolve, reject) {
        sql.qry2(serverSQLPool, "SELECT `AUTO_INCREMENT` FROM  INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?", [serverSQLPool.config.connectionConfig.database, "map"], function(data) {
            resolve(data);
        });
    });
}
*/

async function generateMap(id, pos, playerData, radius, gridSize)
{
    return new Promise(async function(resolve, reject) {
        let mapData = playerData.mapData[id];
        let playerUserID = playerData.players[id].authUserID;
        let ins = "INSERT IGNORE INTO `map` (`xyKey`, `chunkPosX`, `chunkPosY`, `tile`, `seededBy`) VALUES ";
        let sqlQry = [];
        let param = [];
        //let newIns = 0;
        for (let sy = -radius.y; sy <= radius.y; sy++)
        {
            for (let sx = -radius.x; sx <= radius.x; sx++)
            {
                let sPos = {x: pos.x + sx, y: pos.y + sy};
                let xyKey = misc.getXYKey(sPos);
                if (!misc.isDefined(mapData[xyKey]))
                {
                    mapData[xyKey] = {
                        chunkPosX: sPos.x,
                        chunkPosY: sPos.y,
                    };
                    mapData[xyKey].cordId = sPos.x + "_" + sPos.y;
                    mapData[xyKey].globalPos = misc.calcGlobalPos(sPos, gridSize);
                    mapData[xyKey].xyKey = xyKey;
                    mapData[xyKey].chunkLoaded = false;
                    mapData[xyKey].chunkRendered = false;
                    if (misc.rng(0, 100, 3) <= 35)
                    {
                        mapData[xyKey].tile = "wall";
                    } else {
                        mapData[xyKey].tile = "floor";
                    }
                    if (xyKey === "p0_p0")
                        mapData[xyKey].tile = "floor";


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
                    if (misc.isDefined(mapData[northXYKey]) && mapData[northXYKey].tile === "wall")
                        northWall = true;
                    if (misc.isDefined(mapData[southXYKey]) && mapData[southXYKey].tile === "wall")
                        southWall = true;
                    if (misc.isDefined(mapData[eastXYKey]) && mapData[eastXYKey].tile === "wall")
                        eastWall = true;
                    if (misc.isDefined(mapData[westXYKey]) && mapData[westXYKey].tile === "wall")
                        westWall = true;

                    if (mapData[xyKey].tile === "floor" && northWall && southWall && eastWall && westWall)
                    {
                        mapData[xyKey].tile = "wall";
                    }


                    for (let p in playerData.players)
                    {
                        if (sPos.x === playerData.players[p].chunkPos[0] && sPos.y === playerData.players[p].chunkPos[1])
                        {
                            mapData[xyKey].tile = "floor";
                        }
                    }


                    sqlQry.push("(?, ?, ?, ?, ?)");
                    param.push(xyKey);
                    param.push(sPos.x);
                    param.push(sPos.y);
                    param.push(mapData[xyKey].tile);
                    param.push(playerUserID);
                    //newIns++;
                }
            }
        }

        if (sqlQry.length > 0)
        {
            sql.qry(serverSQLPool, ins + sqlQry.join(","), param, function() {});
        }
        resolve({
            mapData: mapData,
            //newIns: newIns,
        });
    });
}

function calcShadow(pos, mapData)
{
    let shadow = false;
    let rotation = false;
    let x = pos.x;
    let y = pos.y;
    let xyKey = misc.getXYKey({x: x, y: y});
    if (!misc.isDefined(mapData[xyKey]))
    {
        return {
            shadow: shadow,
            rotation: rotation,
        };
    }
    if (mapData[xyKey].tile !== "floor")
    {
        return {
            shadow: shadow,
            rotation: rotation,
        };
    }
    let tiles = [];
    /*
    [ 0 ] [ 1 ] [ 2 ]
    [ 3 ] [ 4 ] [ 5 ]
    [ 6 ] [ 7 ] [ 8 ]
    */
    for (let yy = 1; yy >= -1; yy--)
    {
        for (let xx = -1; xx <= 1; xx++)
        {
            let tile = mapData[misc.getXYKey({x: x + xx, y: y + yy})];
            if (!misc.isDefined(tile))
            {
                return {
                    shadow: false,
                    rotation: false,
                };
            }
            tiles.push({
                type: tile.tile,
                is: function(check) {
                    if (check === "wall" && this.type === "wall")
                        return true;
                    if (check === "wall" && this.type === "floor")
                        return false;
                    if (check === "floor" && this.type === "floor")
                        return true;
                    if (check === "floor" && this.type === "wall")
                        return false;
                    if (check === "any")
                        return true;
                },
            });
        }
    }
    if (
        tiles[0].is("any") && tiles[1].is("wall") && tiles[2].is("any") &&
        tiles[3].is("wall") && tiles[4].is("floor") && tiles[5].is("wall") &&
        tiles[6].is("any") && tiles[7].is("wall") && tiles[8].is("any")
    )
    {
        shadow = "hollowBox";
        rotation = 0;
    }

    if (
        tiles[0].is("wall") && tiles[1].is("floor") && tiles[2].is("wall") &&
        tiles[3].is("floor") && tiles[4].is("floor") && tiles[5].is("floor") &&
        tiles[6].is("wall") && tiles[7].is("floor") && tiles[8].is("wall")
    )
    {
        shadow = "crossroad";
        rotation = 0;
    }

    if (
        tiles[0].is("any") && tiles[1].is("floor") && tiles[2].is("any") &&
        tiles[3].is("wall") && tiles[4].is("floor") && tiles[5].is("wall") &&
        tiles[6].is("any") && tiles[7].is("wall") && tiles[8].is("any")
    )
    {
        shadow = "deadEnd";
        rotation = 0; // no change / image facing south like a U shape
    }

    if (
        tiles[0].is("any") && tiles[1].is("wall") && tiles[2].is("any") &&
        tiles[3].is("floor") && tiles[4].is("floor") && tiles[5].is("wall") &&
        tiles[6].is("any") && tiles[7].is("wall") && tiles[8].is("any")
    )
    {
        shadow = "deadEnd";
        rotation = 90; // 90 deg anti-clockwise
    }

    if (
        tiles[0].is("any") && tiles[1].is("wall") && tiles[2].is("any") &&
        tiles[3].is("wall") && tiles[4].is("floor") && tiles[5].is("wall") &&
        tiles[6].is("any") && tiles[7].is("floor") && tiles[8].is("any")
    )
    {
        shadow = "deadEnd";
        rotation = 180;
    }

    if (
        tiles[0].is("any") && tiles[1].is("wall") && tiles[2].is("any") &&
        tiles[3].is("wall") && tiles[4].is("floor") && tiles[5].is("floor") &&
        tiles[6].is("any") && tiles[7].is("wall") && tiles[8].is("any")
    )
    {
        shadow = "deadEnd";
        rotation = 270;
    }

    if (
        tiles[0].is("wall") && tiles[1].is("floor") && tiles[2].is("floor") &&
        tiles[3].is("floor") && tiles[4].is("floor") && tiles[5].is("floor") &&
        tiles[6].is("floor") && tiles[7].is("floor") && tiles[8].is("floor")
    )
    {
        shadow = "floorCorner";
        rotation = 0;
    }

    if (
        tiles[0].is("floor") && tiles[1].is("floor") && tiles[2].is("floor") &&
        tiles[3].is("floor") && tiles[4].is("floor") && tiles[5].is("floor") &&
        tiles[6].is("wall") && tiles[7].is("floor") && tiles[8].is("floor")
    )
    {
        shadow = "floorCorner";
        rotation = 90;
    }

    if (
        tiles[0].is("floor") && tiles[1].is("floor") && tiles[2].is("floor") &&
        tiles[3].is("floor") && tiles[4].is("floor") && tiles[5].is("floor") &&
        tiles[6].is("floor") && tiles[7].is("floor") && tiles[8].is("wall")
    )
    {
        shadow = "floorCorner";
        rotation = 180;
    }

    if (
        tiles[0].is("floor") && tiles[1].is("floor") && tiles[2].is("wall") &&
        tiles[3].is("floor") && tiles[4].is("floor") && tiles[5].is("floor") &&
        tiles[6].is("floor") && tiles[7].is("floor") && tiles[8].is("floor")
    )
    {
        shadow = "floorCorner";
        rotation = 270;
    }

    if (
        tiles[0].is("any") && tiles[1].is("wall") && tiles[2].is("any") &&
        tiles[3].is("floor") && tiles[4].is("floor") && tiles[5].is("floor") &&
        tiles[6].is("floor") && tiles[7].is("floor") && tiles[8].is("floor")
    )
    {
        shadow = "side";
        rotation = 0;
    }

    if (
        tiles[0].is("any") && tiles[1].is("floor") && tiles[2].is("floor") &&
        tiles[3].is("wall") && tiles[4].is("floor") && tiles[5].is("floor") &&
        tiles[6].is("any") && tiles[7].is("floor") && tiles[8].is("floor")
    )
    {
        shadow = "side";
        rotation = 90;
    }

    if (
        tiles[0].is("floor") && tiles[1].is("floor") && tiles[2].is("floor") &&
        tiles[3].is("floor") && tiles[4].is("floor") && tiles[5].is("floor") &&
        tiles[6].is("any") && tiles[7].is("wall") && tiles[8].is("any")
    )
    {
        shadow = "side";
        rotation = 180;
    }

    if (
        tiles[0].is("floor") && tiles[1].is("floor") && tiles[2].is("any") &&
        tiles[3].is("floor") && tiles[4].is("floor") && tiles[5].is("wall") &&
        tiles[6].is("floor") && tiles[7].is("floor") && tiles[8].is("any")
    )
    {
        shadow = "side";
        rotation = 270;
    }

    if (
        tiles[0].is("wall") && tiles[1].is("floor") && tiles[2].is("any") &&
        tiles[3].is("floor") && tiles[4].is("floor") && tiles[5].is("wall") &&
        tiles[6].is("floor") && tiles[7].is("floor") && tiles[8].is("any")
    )
    {
        shadow = "sideCornerA";
        rotation = 0;
    }

    if (
        tiles[0].is("any") && tiles[1].is("wall") && tiles[2].is("any") &&
        tiles[3].is("floor") && tiles[4].is("floor") && tiles[5].is("floor") &&
        tiles[6].is("wall") && tiles[7].is("floor") && tiles[8].is("floor")
    )
    {
        shadow = "sideCornerA";
        rotation = 90;
    }

    if (
        tiles[0].is("any") && tiles[1].is("floor") && tiles[2].is("floor") &&
        tiles[3].is("wall") && tiles[4].is("floor") && tiles[5].is("floor") &&
        tiles[6].is("any") && tiles[7].is("floor") && tiles[8].is("wall")
    )
    {
        shadow = "sideCornerA";
        rotation = 180;
    }

    if (
        tiles[0].is("floor") && tiles[1].is("floor") && tiles[2].is("wall") &&
        tiles[3].is("floor") && tiles[4].is("floor") && tiles[5].is("floor") &&
        tiles[6].is("any") && tiles[7].is("wall") && tiles[8].is("any")
    )
    {
        shadow = "sideCornerA";
        rotation = 270;
    }

    if (
        tiles[0].is("wall") && tiles[1].is("floor") && tiles[2].is("floor") &&
        tiles[3].is("floor") && tiles[4].is("floor") && tiles[5].is("floor") &&
        tiles[6].is("any") && tiles[7].is("wall") && tiles[8].is("any")
    )
    {
        shadow = "sideCornerB";
        rotation = 0;
    }

    if (
        tiles[0].is("floor") && tiles[1].is("floor") && tiles[2].is("any") &&
        tiles[3].is("floor") && tiles[4].is("floor") && tiles[5].is("wall") &&
        tiles[6].is("wall") && tiles[7].is("floor") && tiles[8].is("any")
    )
    {
        shadow = "sideCornerB";
        rotation = 90;
    }

    if (
        tiles[0].is("any") && tiles[1].is("wall") && tiles[2].is("any") &&
        tiles[3].is("floor") && tiles[4].is("floor") && tiles[5].is("floor") &&
        tiles[6].is("floor") && tiles[7].is("floor") && tiles[8].is("wall")
    )
    {
        shadow = "sideCornerB";
        rotation = 180;
    }

    if (
        tiles[0].is("any") && tiles[1].is("floor") && tiles[2].is("wall") &&
        tiles[3].is("wall") && tiles[4].is("floor") && tiles[5].is("floor") &&
        tiles[6].is("any") && tiles[7].is("floor") && tiles[8].is("floor")
    )
    {
        shadow = "sideCornerB";
        rotation = 270;
    }

    if (
        tiles[0].is("any") && tiles[1].is("wall") && tiles[2].is("any") &&
        tiles[3].is("floor") && tiles[4].is("floor") && tiles[5].is("floor") &&
        tiles[6].is("any") && tiles[7].is("wall") && tiles[8].is("any")
    )
    {
        shadow = "straight";
        rotation = 0;
    }

    if (
        tiles[0].is("any") && tiles[1].is("floor") && tiles[2].is("any") &&
        tiles[3].is("wall") && tiles[4].is("floor") && tiles[5].is("wall") &&
        tiles[6].is("any") && tiles[7].is("floor") && tiles[8].is("any")
    )
    {
        shadow = "straight";
        rotation = 90;
    }

    if (
        tiles[0].is("any") && tiles[1].is("wall") && tiles[2].is("any") &&
        tiles[3].is("floor") && tiles[4].is("floor") && tiles[5].is("floor") &&
        tiles[6].is("wall") && tiles[7].is("floor") && tiles[8].is("wall")
    )
    {
        shadow = "tJunc";
        rotation = 0;
    }

    if (
        tiles[0].is("any") && tiles[1].is("floor") && tiles[2].is("wall") &&
        tiles[3].is("wall") && tiles[4].is("floor") && tiles[5].is("floor") &&
        tiles[6].is("any") && tiles[7].is("floor") && tiles[8].is("wall")
    )
    {
        shadow = "tJunc";
        rotation = 90;
    }

    if (
        tiles[0].is("wall") && tiles[1].is("floor") && tiles[2].is("wall") &&
        tiles[3].is("floor") && tiles[4].is("floor") && tiles[5].is("floor") &&
        tiles[6].is("any") && tiles[7].is("wall") && tiles[8].is("any")
    )
    {
        shadow = "tJunc";
        rotation = 180;
    }

    if (
        tiles[0].is("wall") && tiles[1].is("floor") && tiles[2].is("any") &&
        tiles[3].is("floor") && tiles[4].is("floor") && tiles[5].is("wall") &&
        tiles[6].is("wall") && tiles[7].is("floor") && tiles[8].is("any")
    )
    {
        shadow = "tJunc";
        rotation = 270;
    }

    if (
        tiles[0].is("any") && tiles[1].is("wall") && tiles[2].is("any") &&
        tiles[3].is("wall") && tiles[4].is("floor") && tiles[5].is("floor") &&
        tiles[6].is("any") && tiles[7].is("floor") && tiles[8].is("wall")
    )
    {
        shadow = "turn";
        rotation = 0;
    }

    if (
        tiles[0].is("any") && tiles[1].is("floor") && tiles[2].is("wall") &&
        tiles[3].is("wall") && tiles[4].is("floor") && tiles[5].is("floor") &&
        tiles[6].is("any") && tiles[7].is("wall") && tiles[8].is("any")
    )
    {
        shadow = "turn";
        rotation = 90;
    }

    if (
        tiles[0].is("wall") && tiles[1].is("floor") && tiles[2].is("any") &&
        tiles[3].is("floor") && tiles[4].is("floor") && tiles[5].is("wall") &&
        tiles[6].is("any") && tiles[7].is("wall") && tiles[8].is("any")
    )
    {
        shadow = "turn";
        rotation = 180;
    }

    if (
        tiles[0].is("any") && tiles[1].is("wall") && tiles[2].is("any") &&
        tiles[3].is("floor") && tiles[4].is("floor") && tiles[5].is("wall") &&
        tiles[6].is("wall") && tiles[7].is("floor") && tiles[8].is("any")
    )
    {
        shadow = "turn";
        rotation = 270;
    }

    if (
        tiles[0].is("any") && tiles[1].is("wall") && tiles[2].is("any") &&
        tiles[3].is("wall") && tiles[4].is("floor") && tiles[5].is("floor") &&
        tiles[6].is("any") && tiles[7].is("floor") && tiles[8].is("floor")
    )
    {
        shadow = "wallCorner";
        rotation = 0;
    }

    if (
        tiles[0].is("any") && tiles[1].is("floor") && tiles[2].is("floor") &&
        tiles[3].is("wall") && tiles[4].is("floor") && tiles[5].is("floor") &&
        tiles[6].is("any") && tiles[7].is("wall") && tiles[8].is("any")
    )
    {
        shadow = "wallCorner";
        rotation = 90;
    }

    if (
        tiles[0].is("floor") && tiles[1].is("floor") && tiles[2].is("any") &&
        tiles[3].is("floor") && tiles[4].is("floor") && tiles[5].is("wall") &&
        tiles[6].is("any") && tiles[7].is("wall") && tiles[8].is("any")
    )
    {
        shadow = "wallCorner";
        rotation = 180;
    }

    if (
        tiles[0].is("any") && tiles[1].is("wall") && tiles[2].is("any") &&
        tiles[3].is("floor") && tiles[4].is("floor") && tiles[5].is("wall") &&
        tiles[6].is("floor") && tiles[7].is("floor") && tiles[8].is("any")
    )
    {
        shadow = "wallCorner";
        rotation = 270;
    }

    if (
        tiles[0].is("wall") && tiles[1].is("floor") && tiles[2].is("wall") &&
        tiles[3].is("floor") && tiles[4].is("floor") && tiles[5].is("floor") &&
        tiles[6].is("floor") && tiles[7].is("floor") && tiles[8].is("floor")
    )
    {
        shadow = "floorOpeningA";
        rotation = 0;
    }

    if (
        tiles[0].is("wall") && tiles[1].is("floor") && tiles[2].is("floor") &&
        tiles[3].is("floor") && tiles[4].is("floor") && tiles[5].is("floor") &&
        tiles[6].is("wall") && tiles[7].is("floor") && tiles[8].is("floor")
    )
    {
        shadow = "floorOpeningA";
        rotation = 90;
    }

    if (
        tiles[0].is("floor") && tiles[1].is("floor") && tiles[2].is("floor") &&
        tiles[3].is("floor") && tiles[4].is("floor") && tiles[5].is("floor") &&
        tiles[6].is("wall") && tiles[7].is("floor") && tiles[8].is("wall")
    )
    {
        shadow = "floorOpeningA";
        rotation = 180;
    }

    if (
        tiles[0].is("floor") && tiles[1].is("floor") && tiles[2].is("wall") &&
        tiles[3].is("floor") && tiles[4].is("floor") && tiles[5].is("floor") &&
        tiles[6].is("floor") && tiles[7].is("floor") && tiles[8].is("wall")
    )
    {
        shadow = "floorOpeningA";
        rotation = 270;
    }

    if (
        tiles[0].is("wall") && tiles[1].is("floor") && tiles[2].is("wall") &&
        tiles[3].is("floor") && tiles[4].is("floor") && tiles[5].is("floor") &&
        tiles[6].is("wall") && tiles[7].is("floor") && tiles[8].is("floor")
    )
    {
        shadow = "floorOpeningB";
        rotation = 0;
    }

    if (
        tiles[0].is("wall") && tiles[1].is("floor") && tiles[2].is("floor") &&
        tiles[3].is("floor") && tiles[4].is("floor") && tiles[5].is("floor") &&
        tiles[6].is("wall") && tiles[7].is("floor") && tiles[8].is("wall")
    )
    {
        shadow = "floorOpeningB";
        rotation = 90;
    }

    if (
        tiles[0].is("floor") && tiles[1].is("floor") && tiles[2].is("wall") &&
        tiles[3].is("floor") && tiles[4].is("floor") && tiles[5].is("floor") &&
        tiles[6].is("wall") && tiles[7].is("floor") && tiles[8].is("wall")
    )
    {
        shadow = "floorOpeningB";
        rotation = 180;
    }

    if (
        tiles[0].is("wall") && tiles[1].is("floor") && tiles[2].is("wall") &&
        tiles[3].is("floor") && tiles[4].is("floor") && tiles[5].is("floor") &&
        tiles[6].is("floor") && tiles[7].is("floor") && tiles[8].is("wall")
    )
    {
        shadow = "floorOpeningB";
        rotation = 270;
    }

    if (
        tiles[0].is("floor") && tiles[1].is("floor") && tiles[2].is("wall") &&
        tiles[3].is("floor") && tiles[4].is("floor") && tiles[5].is("floor") &&
        tiles[6].is("wall") && tiles[7].is("floor") && tiles[8].is("floor")
    )
    {
        shadow = "floorOpeningC";
        rotation = 0;
    }

    if (
        tiles[0].is("wall") && tiles[1].is("floor") && tiles[2].is("floor") &&
        tiles[3].is("floor") && tiles[4].is("floor") && tiles[5].is("floor") &&
        tiles[6].is("floor") && tiles[7].is("floor") && tiles[8].is("wall")
    )
    {
        shadow = "floorOpeningC";
        rotation = 90;
    }

    return {
        shadow: shadow,
        rotation: rotation,
    };
}

async function breakDeadEnds()
{
    let mapData = await loadMapData();
    let bounds = {minX: 0, minY: 0, maxX: 0, maxY: 0};
    let checked = {};
    for (let id in mapData)
    {
        checked[id] = false;
        let chunkPos = {
            x: mapData[id].chunkPosX,
            y: mapData[id].chunkPosY,
        };
        if (chunkPos.x < bounds.minX)
            bounds.minX = chunkPos.x;
        if (chunkPos.y < bounds.minY)
            bounds.minY = chunkPos.y;
        if (chunkPos.x > bounds.maxX)
            bounds.maxX = chunkPos.x;
        if (chunkPos.y > bounds.maxY)
            bounds.maxY = chunkPos.y;
    }
    let pos = {x: 0, y: 0};
    let startTime = misc.now();
    let dig = true;
    let UP = 0;
    let DOWN = 1;
    let LEFT = 2;
    let RIGHT = 3;
    let dir = RIGHT;
    let changeDir = function(moveDir)
    {
        let xyKey;
        let tileAt;
        let moved = false;
        if (moveDir === UP)
        {
            if (pos.y + 1 < bounds.maxY)
            {
                xyKey = misc.getXYKey({x: pos.x, y: pos.y + 1});
                tileAt = mapData[xyKey].tile;
                if (tileAt === "wall")
                {
                    if (changeDir(RIGHT))
                    dir = RIGHT;
                } else {
                    pos.y++;
                    moved = true;
                }
            } else {
                dir = RIGHT;
            }
        }
        if (moveDir === DOWN)
        {
            if (pos.y - 1 > bounds.minY)
            {
                xyKey = misc.getXYKey({x: pos.x, y: pos.y - 1});
                tileAt = mapData[xyKey].tile;
                if (tileAt === "wall")
                {
                    dir = LEFT;
                } else {
                    pos.y--;
                    moved = true;
                }
            } else {
                dir = LEFT;
            }
        }
        if (moveDir === RIGHT)
        {
            if (pos.x + 1 < bounds.maxX)
            {
                xyKey = misc.getXYKey({x: pos.x + 1, y: pos.y});
                tileAt = mapData[xyKey].tile;
                if (tileAt === "wall")
                {
                    dir = DOWN;
                } else {
                    pos.x++;
                    moved = true;
                }
            } else {
                dir = DOWN;
            }
        }
        if (moveDir === LEFT)
        {
            if (pos.x - 1 > bounds.minX)
            {
                xyKey = misc.getXYKey({x: pos.x - 1, y: pos.y});
                tileAt = mapData[xyKey].tile;
                if (tileAt === "wall")
                {
                    dir = UP;
                } else {
                    pos.x--;
                    moved = true;
                }
            } else {
                dir = UP;
            }
        }
        return moved;
    }
    while (dig)
    {
        let xyKey = misc.getXYKey(pos);
        let tileAt = mapData[xyKey].tile;
        if (changeDir(dir))
        {
            checked[xyKey] = tileAt;
            misc.dump(xyKey + " " + tileAt);
        }
        if (misc.now() - startTime > 10)
            break;
    }
}

async function generateMaze(dimX, dimY, orgX = false, orgY = false)
{
    let SETTINGS = await settings.getSettings();
    let playerScale = parseFloat(SETTINGS.playerScale);
    let gridSize = parseInt(parseInt(SETTINGS.gridSize) * playerScale);

    if (dimX % 2 === 0)
        dimX++;
    if (dimY % 2 === 0)
        dimY++;
    let padding = {x: 0, y: 0};
    let size = {x: dimX, y: dimY};
    let thickness = {floors: 1, walls: 1};
    let thisMaze = mazeDefaults(size, padding, thickness);
    let cantMove = false;
    let pos = {
        x: misc.rng(0, Math.floor(dimX / 2) - 1) * 2 + 1,
        y: misc.rng(0, Math.floor(dimY / 2) - 1) * 2 + 1,
    };
    let mazeIndex = (size.x * pos.y) + pos.x;
    thisMaze[mazeIndex] = 1;
    let moveIndex = 1;
    let lastPos = [];
    let picked, pickedDir = "";
    let mazeData = [];
    while (!cantMove)
    {
        picked = pickDir(thisMaze, pos, size, padding);
        if (picked)
        {
            pickedDir = picked.name;
            lastPos[moveIndex] = [pos.x, pos.y];
            pos.x += picked.dir.x;
            pos.y += picked.dir.y;
            mazeIndex = (size.x * pos.y) + pos.x;
            thisMaze[mazeIndex] = 1;
            pos.x += picked.dir.x;
            pos.y += picked.dir.y;
            mazeIndex = (size.x * pos.y) + pos.x;
            thisMaze[mazeIndex] = 1;
            moveIndex++;
        } else {
            if (moveIndex > 0)
            {
                if (lastPos[moveIndex] != null)
                {
                    pos = {x: lastPos[moveIndex][0], y: lastPos[moveIndex][1]};
                }
                moveIndex--;
            } else {
                cantMove = true;
                break;
            }
        }
    }

    if (!orgX)
        orgX = Math.floor(size.x / 2);
    else
        orgX = 0;
    if (!orgY)
        orgY = Math.floor(size.y / 2);
    else
        orgY = 0;
    for (let y = 0; y < size.y + padding.y; y++)
    {
        for (let x = 0; x < size.x + padding.x; x++)
        {
            let i = (size.x * y) + x;
            let id = i + 1;
            let chunkPos = {
                x: x - orgX,
                y: y - orgY,
            };
            mazeData.push({
                id: id,
                chunkPosX: chunkPos.x,
                chunkPosY: chunkPos.y,
                tile: thisMaze[i] === 0 ? "wall" : "floor",
                cordId: chunkPos.x + "_" + chunkPos.y,
            });
        }
    }
    return mazeData;
}

function mazeDefaults(size, padding, thickness)
{
    let thisMaze = [];
    let i = 0;
    for (let y = 0; y < size.y + padding.y; y++)
    {
        for (let x = 0; x < size.x + padding.x; x++)
        {
            thisMaze[i] = 0;
            i++;
        }
    }
    return thisMaze;
}

function canMove(thisMaze, x, y, size, padding)
{
    if (x < padding.x || x > size.x - (padding.x + 1) || y < padding.y || y > size.y - (padding.y + 1))
    {
        return false;
    } else {
        let index = (size.x * y) + x;
        if (thisMaze[index] === 0)
        {
            // can move, no path here
            return true;
        } else {
            // cant move, we have a path
            return false;
        }
    }
}

function pickDir(thisMaze, pos, size, padding)
{
    let north = canMove(thisMaze, pos.x, pos.y - 2, size, padding);
    let south = canMove(thisMaze, pos.x, pos.y + 2, size, padding);
    let east = canMove(thisMaze, pos.x - 2, pos.y, size, padding);
    let west = canMove(thisMaze, pos.x + 2, pos.y, size, padding);
    let dir = [];
    let name = [];
    let picked = 0;
    let pick;
    if (north)
    {
        dir[picked] = {x: 0, y: -1};
        name[picked] = "north";
        picked++;
    }
    if (south)
    {
        dir[picked] = {x: 0, y: 1};
        name[picked] = "south";
        picked++;
    }
    if (east)
    {
        dir[picked] = {x: -1, y: 0};
        name[picked] = "east";
        picked++;
    }
    if (west)
    {
        dir[picked] = {x: 1, y: 0};
        name[picked] = "west";
    }
    let max = dir.length;
    if (max > 0)
    {
        pick = misc.rng(0, max - 1, 0, 1000);
        return {dir: dir[pick], name: name[pick]};
    } else {
        return false;
    }
}

module.exports = {
    loadMapData: loadMapData,
    generateMap: generateMap,
    calcShadow: calcShadow,
    breakDeadEnds: breakDeadEnds,
    generateMaze: generateMaze,
};