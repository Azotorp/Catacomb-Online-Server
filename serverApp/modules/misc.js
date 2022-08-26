const crypto = require('crypto');
const { performance } = require('perf_hooks');
function dump(input)
{
    console.log(input);
}

let rng = function(min = 0, max = 1, precision = 0)
{
    let v = [];
    if (max < min)
        max = min + 1;
    if (min === max)
        return min;
    if (precision === 0)
    {
        v = Math.floor(Math.random() * (max - min + 1) + min);
    } else {
        let pf = Math.pow(10,precision);
        v = ((Math.round((Math.random() * (max - min) + min) * pf) / pf)).toFixed(precision);
    }
    if (precision === 0)
        return parseInt(v);
    else
        return parseFloat(v);
}

function isObj(obj)
{
    if (typeof obj === 'object' && !Array.isArray(obj) && obj !== null)
        return true;
    else
        return false;
}

function getObjMap(list, primaryKey, key2 = false)
{
    const keyValuePairs = list.map(item => [item[primaryKey], item]);
    return Object.fromEntries(keyValuePairs);
}

function calcChunkPos(globalPos, gridSize = 1024)
{
    if (!isObj(globalPos))
    {
        return [Math.floor((globalPos[0] - (gridSize / 2)) / gridSize) + 1, Math.floor((globalPos[1] - (gridSize / 2)) / gridSize) + 1];
    } else {
        return {x: Math.floor((globalPos.x - (gridSize / 2)) / gridSize) + 1, y: Math.floor((globalPos.y - (gridSize / 2)) / gridSize) + 1};
    }
}

function calcGlobalPos(chunkPos, gridSize = 1024)
{
    if (!isObj(chunkPos))
    {
        return [chunkPos[0] * gridSize, chunkPos[1] * gridSize];
    } else {
        return {x: chunkPos.x * gridSize, y: chunkPos.y * gridSize};
    }
}

function getChunkPosFromIndex(mazeIndex, size)
{
    return {x: mazeIndex % size.x, y: Math.floor(mazeIndex / size.x)};
}

function getIndexFromChunkPos(chunkPos, size)
{
    return (size.x * chunkPos.y) + chunkPos.x;
}

let filterObj = function(array, cvar, cval)
{
    if (typeof array === 'object' && !Array.isArray(array) && array !== null)
        array = Object.values(array);
    let result = array.filter(obj => {
        return obj[cvar] === cval;
    })
    return result;
}

let filterObj2 = function(array, cvar, cval)
{
    if (isObj(array))
        array = Object.values(array);
    let result = array.filter(obj => {
        return obj[cvar] === cval;
    })
    if (result.length === 1)
    {
        return result[0];
    } else {
        return result;
    }
}

function objLength(obj)
{
    if (isObj(obj))
        return Object.keys(obj).length;
    else
        return obj.length;
}

function shuffleArray(array)
{
    return array.map(value => ({ value, sort: Math.random() })).sort((a, b) => a.sort - b.sort).map(({ value }) => value);
}

let now = function(last = 0)
{
    return performance.now() - last;
}

let isDefined = function(x)
{
    let undefined;
    return x !== undefined;
}

let sha256 = function(input)
{
    return crypto.createHash('sha256').update(input).digest('hex');
}

let convRad = function(ang)
{
    ang = ang % (2 * Math.PI);
    if (ang < 0)
    {
        ang += (2 * Math.PI);
    }
    return ang;
}

let toDeg = function(r)
{
    return r * (180 / Math.PI);
}

let toRad = function(d)
{
    return d / (180 / Math.PI);
}

let angle = function(lookingFrom, lookingAt = false)
{
    let at;
    if (lookingAt !== false)
    {
        at = Math.atan2(lookingAt.y - lookingFrom.y, lookingAt.x - lookingFrom.x);
    } else {
        at = Math.atan2(lookingFrom.y, lookingFrom.x);
    }
    return convRad(at);
}

function time(dateStr = false, ms = false)
{
    let date;
    if (dateStr)
        date = new Date(dateStr);
    else
        date = new Date();
    if (ms)
        return date.getTime();
    else
        return Math.floor(date.getTime() / 1000);
}

function angleDist(angle1, angle2, absolute = false)
{
    let ang_dist1;
    let ang_dist2;
    let dist;
    if (!absolute)
    {
        ang_dist1 = Math.abs(angle1 - angle2);
        ang_dist2 = toRad(360) - ang_dist1;
        dist = ang_dist1;
        if (ang_dist1 > ang_dist2)
        {
            dist = ang_dist2;
        }
    } else {
        if (angle1 <= angle2)
        {
            dist = angle2 - angle1;
        } else {
            dist = angle1 - angle2;
        }
    }
    return dist;
}

function angleMoveDir(angleGoal, curAngle)
{
    let turndir = 1;
    if (curAngle > angleGoal && curAngle - angleGoal <= toRad(180))
    {
        turndir = -1;
    } else if (curAngle > angleGoal && curAngle - angleGoal > toRad(180))
    {
        turndir = 1;
    } else if (angleGoal > curAngle && angleGoal - curAngle <= toRad(180))
    {
        turndir = 1;
    } else if (angleGoal > curAngle && angleGoal - curAngle > toRad(180))
    {
        turndir = -1;
    }
    return turndir;
}

function distance(obj1, obj2 = false)
{
    if (!isObj(obj1))
        obj1 = {x: obj1[0], y: obj1[1]};
    if (obj2 !== false)
    {
        if (!isObj(obj2))
            obj2 = {x: obj2[0], y: obj2[1]};
        return Math.sqrt(Math.pow(obj1.x - obj2.x,2) + Math.pow(obj1.y - obj2.y,2));
    } else {
        return Math.sqrt(Math.pow(obj1.x,2) + Math.pow(obj1.y,2));
    }
}

function getXYKey(pos)
{
    let xyKey = "";
    if (pos.x >= 0)
    {
        xyKey += "p" + pos.x;
    } else {
        xyKey += "n" + Math.abs(pos.x);
    }
    if (pos.y >= 0)
    {
        xyKey += "_p" + pos.y;
    } else {
        xyKey += "_n" + Math.abs(pos.y);
    }
    return xyKey;
}

function getXYPos(xyKey)
{
    let data = xyKey.split("_");
    let xData = data[0];
    let yData = data[1];
    let x = parseInt(xData.substr(1));
    if (xData.substr(0, 1) === "n")
    {
        x = parseInt(xData.substr(1)) * -1;
    }
    let y = parseInt(yData.substr(1));
    if (yData.substr(0, 1) === "n")
    {
        y = parseInt(yData.substr(1)) * -1;
    }
    return {x: x, y: y};
}

function genNewID(length, options = {upper: true, lower: true, numbers: true, symbols: false}) {
    let result = "";
    let char = "";
    if (options.upper)
        char += "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    if (options.lower)
        char += "abcdefghijklmnopqrstuvwxyz";
    if (options.numbers)
        char += "0123456789";
    if (options.symbols)
        char += "~!@#$%^&*()-_+={}/.,:;[]?";
    let charLength = char.length;
    for (let i = 0; i < length; i++) {
        result += char.charAt(Math.floor(Math.random() * charLength));
    }
    return result;
}

module.exports = {
    dump: dump,
    rng: rng,
    isObj: isObj,
    getObjMap: getObjMap,
    calcChunkPos: calcChunkPos,
    calcGlobalPos: calcGlobalPos,
    getChunkPosFromIndex: getChunkPosFromIndex,
    getIndexFromChunkPos: getIndexFromChunkPos,
    filterObj: filterObj,
    filterObj2: filterObj2,
    objLength: objLength,
    shuffleArray: shuffleArray,
    now: now,
    isDefined: isDefined,
    sha256: sha256,
    convRad: convRad,
    toRad: toRad,
    toDeg: toDeg,
    angle: angle,
    time: time,
    angleDist: angleDist,
    angleMoveDir: angleMoveDir,
    distance: distance,
    getXYKey: getXYKey,
    getXYPos: getXYPos,
    genNewID: genNewID,
};