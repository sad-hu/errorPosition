const { SourceMapConsumer } = require('source-map')
const path = require('path')
const fs = require('fs')

/**
 * 输入err：错误堆栈字符串
 * 输入：sourceMap文件路径
 * 输出sourceMap：错误位置代码相关信息
 */
async function errorPosition(err, sourceMap) { 
    // 解析错误堆栈字符串
    let errStack = parseError(err);
    // 根据错误堆栈和sourceMap文件找到实际位置
    let result = await sourceMapDeal(sourceMap, errStack);
    return result;
}

/**
 * 解析错误堆栈字符串
 * @param err 错误堆栈字符串 
 */
function parseError(err) { 
    let arr = err.split('\n');
    let stack = [];
    let message = '';
    arr.forEach(val => {
        val = val.trim();
        if (/^(exception:)/.test(val)) {
            message = val;
        } else if (/^(at )/.test(val)) { 
            let res = val.match(/[(]{0,1}(\S+):(\d+):(\d+)/);
            let res1 = val.match(/^at\s+(\S+)\s+\(/);
            if (res) { 
                let url = res[1] ? res[1] : '';
                let line = res[2] ? res[2] : 0;
                let col = res[3] ? res[3] : 0;
                stack.push({
                    code: res1 && res1[1] ? res1[1] : '',
                    url,
                    line,
                    col
                })
            }
        }
    });
    return {
        message: message,
        stack: stack
    }
}

/**
 * 获取souceMap的consumer
 * @param {*} sourceMapPath souceMap文件所在文件夹路径
 * @param {*} filename sourceMap文件名
 */
async function getSourceMapConsumer(sourceMapPath, filename) { 
    let mapPath = path.join(sourceMapPath, filename + '.map');
    let rawSourceMap = fs.readFileSync(mapPath).toString();
    let consumer = await new SourceMapConsumer(rawSourceMap);
    return consumer;
}

/**
 * 处理souceMpa文件
 * @param {*} sourceMapPath souceMap文件所在文件夹路径
 * @param {*} errStack 错误堆栈
 */
async function sourceMapDeal(sourceMapPath, errStack) { 
    let stack = errStack.stack;
    let consumerObj = {};
    let result = [];
    for (let i = 0; i < stack.length; i++) { 
        let value = stack[i];
        let url = value.url;
        let res = url.match(/[\/\(\s\\]([A-Za-z_-]+.js)$/)
        let filename = res && res[1] ? res[1] : false;
        if (filename && !consumerObj[filename]) {
            let consumer = await getSourceMapConsumer(sourceMapPath, filename);
            consumerObj[filename] = consumer;
        }
        let obj = getSourceCode(consumerObj[filename] || '', value); 
        result.push(obj);
    }
    return result;
}

/**
 * 获取源码所在位置、所在行代码等信息
 * @param {*} consumer souceMap文件的consumer
 * @param {*} stack 错误堆栈解析后的信息
 */
function getSourceCode(consumer, stack) { 
    if (!consumer) { 
        return {
            stack: stack,
            ret: false
        };
    }
    let sm = consumer.originalPositionFor({
        line: parseInt(stack.line),  // 压缩后的行数
        column: parseInt(stack.col)  // 压缩后的列数
    });
    // 压缩前的所有源文件列表
    var sources = consumer.sources;
    // 根据查到的source，到源文件列表中查找索引位置
    var smIndex = sources.indexOf(sm.source);
    if (smIndex >= 0) {
        // 到源码列表中查到源代码
        var smContent = consumer.sourcesContent[smIndex] || '';
        const rawLines = smContent.split(/\r?\n/g);
        return {
            code: rawLines[sm.line - 1],
            ...sm,
            stack: stack,
            ret: true
        };
    } else { 
        return {
            stack: stack,
            ret: false
        };
    }   
}

module.exports = errorPosition;