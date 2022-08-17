const misc = require("./misc.js");
const sql = require("./sql.js");
const settings = require("./settings.js");
const physics = require("./physics.js");
const serverSQLPool = sql.serverSQLConnect();

async function loadMapData()
{
    let SETTINGS = await settings.qrySettings();
    let playerScale = parseFloat(SETTINGS.playerScale);
    let gridSize = parseInt(parseInt(SETTINGS.gridSize) * playerScale);
    return new Promise(function(resolve, reject) {
        sql.qry(serverSQLPool, "select * from `map`", [], function (data) {
            if (misc.objLength(data) > 0)
            {
                let tiles = data;
                let tilesData = {};
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
                        tilesData[xyKey] = tiles[i];
                        tiles[i].chunkLoaded = false;
                        tiles[i].chunkRendered = false;
                    if (tiles[i].tile === "wall")
                    {
                        //physics.newWallBody(id, pos, gridSize, gridSize);
                    }
                }
                resolve(tilesData);
            }
        });
    });
}

async function generateMap(pos, mapData, gridSize, playerUserID, step = 0)
{
    return new Promise(function(resolve, reject) {
        for (let sy = -1; sy <= 1; sy++)
        {
            for (let sx = -1; sx <= 1; sx++)
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
                    if (misc.rng(0, 100, 3) <= 10)
                    {
                        mapData[xyKey].tile = "wall";
                    } else {
                        mapData[xyKey].tile = "floor";
                    }
                    //misc.dump(mapData[xyKey]);
                    sql.qry(serverSQLPool, "INSERT IGNORE INTO `map` (`chunkPosX`, `chunkPosY`, `tile`, `seededBy`) VALUES (?, ?, ?, ?)", [sPos.x, sPos.y, mapData[xyKey].tile, playerUserID], function(ins) {
                        let id = ins.insertId;
                        mapData[xyKey].id = id;
                    });
                }
            }
        }
        resolve(mapData);
    });
}

async function generateMaze(dimX, dimY, orgX = false, orgY = false)
{
    let SETTINGS = await settings.qrySettings();
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
    generateMap: generateMap,
    generateMaze: generateMaze,
    loadMapData: loadMapData,
};