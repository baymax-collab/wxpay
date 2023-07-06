const axios = require("axios");


const crypto = require("crypto");
const fs = require('fs')
const path = require('path')
const pem = fs.readFileSync(path.join(__dirname + '/v3cert/', 'apiclient_key.pem')).toString()
const config = require('./v3config')
const {appid,secret,mchid,serial_no} = config

//授权页面获取openid
const getOpenId = async (code) => {
    let result = await axios({
        url: `https://api.weixin.qq.com/sns/oauth2/access_token?appid=${appid}&secret=${secret}&code=${code}&grant_type=authorization_code`,
        method: 'Get',
    })
    let data = result.data
    if (data.errcode) return false
    return data
}




/**
 * 获取随机的订单号
 */
function createtrade_no() {
    let time = new Date().getTime().toString() + "wxzf"
    return time
};
async function prePay(data) {
    let notify_url = 'https://xxx.xxx.com/api/gvrchat/wechat/v3/notify'
    let attach = 'test'
    let url = '/v3/pay/transactions/jsapi';

    let params = {
        "mchid": mchid,//直连商户号
        "out_trade_no": createtrade_no(),//商户系统内部订单号，只能是数字、大小写字母_-*且在同一个商户号下唯一
        "appid": appid,//应用ID
        "description": 'wx pay',//商品描述
        "attach": attach,//附加数据
        "notify_url": notify_url,//通知地址
        "amount": {
            "total": 1,//总金额,单位为分
            "currency": "CNY"
        },
        "payer": {
            "openid": data.openid//用户标识
        }
    }
    //获取prepay_id
    let result = await axios({
        url: "https://api.mch.weixin.qq.com/v3/pay/transactions/jsapi",
        method: "post",
        headers: {
            "Authorization": sgin('POST', url, params)
        },
        data: params
    });
    // 配置调起支付参数
    let prepay_id = result.data.prepay_id;
    let timestamp = parseInt(new Date().getTime() / 1000).toString();
    let nonce_str = new Date().getTime().toString();
    let jiamiPaySign = appid + "\n" + timestamp + "\n" + nonce_str + "\n" + `prepay_id=${prepay_id}` + "\n";
    let signaturePaySign = sha256(jiamiPaySign);
    //-----------------------------------------------------
    // 保存支付参数到数据库
    //-----------------------------------------------------
    return {
        appId: appid,//公众号ID，由商户传入
        timeStamp: timestamp,//时间戳，自1970年以来的秒数
        nonceStr: nonce_str,//随机串
        package: `prepay_id=${prepay_id}`,
        signType: "RSA",//微信签名方式：
        paySign: signaturePaySign,//微信签名
    }
}

//RSA-SHA256加密
function sha256(str) {
    let privateKey = pem;
    let sign = crypto.createSign('RSA-SHA256');
    sign.update(Buffer.from(str, 'utf-8'));
    let signature = sign.sign(privateKey, 'base64');
    return signature;
}

//签名
function sgin(method, url, params = "") {
    let timestamp = parseInt(new Date().getTime() / 1000);
    let nonce_str = new Date().getTime();
    params = JSON.parse(JSON.stringify(params));
    let message = method + "\n"
        + url + "\n"
        + timestamp + "\n"
        + nonce_str + "\n"
        + JSON.stringify(params) + "\n";
    let signature = sha256(message);
    let auth = `WECHATPAY2-SHA256-RSA2048 mchid="${mchid}",serial_no="${serial_no}",nonce_str="${nonce_str}",timestamp="${timestamp}",signature="${signature}"`;
    return auth;
}

function decodeByAES(cipherText,key,iv,add){
    let rst = '';
    cipherText = Buffer.from(cipherText, 'base64');
    let authTag = cipherText.slice(cipherText.length - 16);
    let data = cipherText.slice(0, cipherText.length - 16);
    let decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    decipher.setAAD(Buffer.from(add));
    rst = decipher.update(data, 'binary', 'utf8');
    try {
        rst += decipher.final('utf-8');
    } catch (e) {
        console.log('error:::',e.toString());
    }
    return rst;
}

exports.notify  = (body)=>{
    const key = config.key;
    const ciphertext = body.resource.ciphertext;
    const nonce = body.resource.nonce;
    const associated_data = body.resource.associated_data;
//解密
    let data = JSON.parse(decodeByAES(ciphertext,key,nonce,associated_data));
    console.log("解密",data)
}
exports.wxpay = async (code) => {
    //on2NOw_LHl1DLV0wN_TEp0DM960o
    let openidData = await getOpenId(code)
    if(!openidData) return
    let {openid} = openidData
    let preData = await prePay({openid})
    return preData
    // console.log(openidData)
}
