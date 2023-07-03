/*这个是用于网页端调起支付用的
* 微信的jssdk需要签名，而获取签名算法有需要获取access_token以及jsapi_ticket,这里是相应的算法
* */
const axios = require("axios");
const config = require('./v3config')
const crypto = require('crypto');
const {appid, secret, mchid, serial_no} = config
let storage = {}

async function wx_access_token(){
    let data = await axios("https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid="+appid+"&secret="+secret)
    data = data.data
    if(data.errcode)return
    let timeExpires = new Date().getTime() + 7000 * 1000
    let option = {expires: timeExpires, value: data.access_token}
    storage.access_token = option
    return option
}
/**
 * 获取access_token
 * @returns {*}
 */
async function get_access_token() {
    let data = storage.access_token
    let redata
    if (data) {
        let time = new Date().getTime()
        if (time < data.expires) {
            redata = data.value
        } else {
            redata = await wx_access_token()
            redata = redata.value
        }
    } else {
        redata = await wx_access_token()
        redata = redata.value
    }
    return redata
}

//从微信获取jsapi_ticket
async function wx_jsapi_ticket() {
    let access_token = await get_access_token()
    if(!access_token)return
    let wxdata = await axios(`https://api.weixin.qq.com/cgi-bin/ticket/getticket?access_token=${access_token}&type=jsapi`)
    let timeExpires = new Date().getTime() + 7000 * 1000
    let option = {expires: timeExpires, value: wxdata.data.ticket}
    storage.jsapi_ticket = option
    return option
}
//7200秒后jsapi_ticket失效，7000s 更新一次
async function get_jsapi_ticket() {
    let data = storage.jsapi_ticket
    let redata
    if (data) {
        let time = new Date().getTime()
        if (time < data.expires) {
            redata = data.value
        } else {
            redata = await wx_jsapi_ticket()
            redata = redata.value
        }
    } else {
        redata = await wx_jsapi_ticket()
        redata = redata.value
    }
    return redata
}
/**
 * 生成签名的随机串
 * @return {字符串}
 */
function createNonceStr() {
    return Math.random().toString(36).substr(2, 15)
}

/**
 * 生成签名的时间戳
 * @return {字符串}
 */
function createTimestamp() {
    return parseInt(new Date().getTime() / 1000) + ''
}
// sha1加密
function sha1(str) {
    let shasum = crypto.createHash("sha1")
    shasum.update(str)
    str = shasum.digest("hex")
    return str
}

function raw(args) {
    var keys = Object.keys(args);
    keys = keys.sort()
    var newArgs = {};
    keys.forEach(function (key) {
        newArgs[key.toLowerCase()] = args[key];
    });

    var string = '';
    for (var k in newArgs) {
        string += '&' + k + '=' + newArgs[k];
    }
    string = string.substr(1);
    return string;
};
//为js-sdk生成签名算法
function jssdkSign(jsapi_ticket, noncestr, timestamp, url) {
    var ret = {jsapi_ticket: jsapi_ticket, noncestr: noncestr, timestamp: timestamp, url: url}
    let string = raw(ret);

    return sha1(string)
}

async function jssdk(url) {
    let jsapi_ticket = await get_jsapi_ticket()
    let nonce_str = createNonceStr();//16位随机串
    let timestamp = createTimestamp()
    let sign = jssdkSign(jsapi_ticket, nonce_str, timestamp, url)
    return {timestamp, nonce_str, sign}
}

exports.getjssdk = async function (url) {
    let data = await jssdk(url)
    data.appid = appid
    return data
}
