/**
 * SillyTavern正则引擎 - 用于TTS文本处理
 * 基于SillyTavern的正则系统实现
 */

/**
 * @typedef {Object} RegexScript
 * @property {string} id - 脚本唯一标识
 * @property {string} scriptName - 脚本名称
 * @property {string} findRegex - 查找正则表达式（字符串形式，如 "/pattern/flags"）
 * @property {string} replaceString - 替换字符串（支持 $1, $2, $<name> 等捕获组）
 * @property {string[]} trimStrings - 要从匹配结果中移除的字符串数组
 * @property {boolean} disabled - 是否禁用此脚本
 * @property {number} substituteRegex - 是否替换正则中的宏（0=不替换, 1=原始, 2=转义）
 */

/**
 * 从字符串创建正则表达式对象
 * 支持 /pattern/flags 格式
 * @param {string} str - 正则表达式字符串
 * @returns {RegExp|null} 正则表达式对象，失败返回null
 */
function regexFromString(str) {
    if (!str || typeof str !== 'string') {
        return null;
    }

    try {
        // 检查是否是 /pattern/flags 格式
        const match = str.match(/^\/(.*)\/([gimsuvy]*)$/);
        if (match) {
            return new RegExp(match[1], match[2]);
        }
        // 如果不是标准格式，尝试直接创建（默认添加 g 标志）
        return new RegExp(str, 'g');
    } catch (error) {
        console.error('Failed to create regex from string:', str, error);
        return null;
    }
}

/**
 * 执行单个正则脚本
 * @param {RegexScript} regexScript - 要执行的正则脚本
 * @param {string} rawString - 要处理的原始字符串
 * @returns {string} 处理后的字符串
 */
export function runRegexScript(regexScript, rawString) {
    // 基本验证
    if (!regexScript || !rawString || typeof rawString !== 'string') {
        return rawString || '';
    }

    // 如果脚本被禁用，直接返回原字符串
    if (regexScript.disabled) {
        console.debug(`Regex script "${regexScript.scriptName}" is disabled, skipping`);
        return rawString;
    }

    // 如果没有查找正则，直接返回原字符串
    if (!regexScript.findRegex) {
        console.warn(`Regex script "${regexScript.scriptName}" has no findRegex, skipping`);
        return rawString;
    }

    try {
        // 创建正则表达式对象
        const findRegex = regexFromString(regexScript.findRegex);
        if (!findRegex) {
            console.error(`Failed to create regex for script "${regexScript.scriptName}"`);
            return rawString;
        }

        // 执行替换
        const newString = rawString.replace(findRegex, function() {
            const args = [...arguments];
            const match = args[0]; // 完整匹配
            
            // 如果没有替换字符串，返回空（相当于删除匹配的内容）
            if (!regexScript.replaceString) {
                console.debug(`Script "${regexScript.scriptName}" deleting match: "${match.substring(0, 50)}..."`);
                return '';
            }

            // 处理替换字符串中的捕获组
            let replaceString = regexScript.replaceString;
            
            // 替换 {{match}} 为 $0
            replaceString = replaceString.replace(/\{\{match\}\}/gi, '$0');
            
            // 处理编号捕获组 ($1, $2, ...) 和命名捕获组 ($<name>)
            const result = replaceString.replace(/\$(\d+)|\$<([^>]+)>/g, (_, num, groupName) => {
                let capturedMatch = '';
                
                if (num) {
                    // 处理编号捕获组
                    const index = Number(num);
                    capturedMatch = args[index] || '';
                } else if (groupName) {
                    // 处理命名捕获组
                    const groups = args[args.length - 1];
                    if (groups && typeof groups === 'object') {
                        capturedMatch = groups[groupName] || '';
                    }
                }

                // 如果没有匹配到，返回空字符串
                if (capturedMatch === undefined || capturedMatch === null) {
                    return '';
                }

                // 从匹配中移除 trimStrings
                if (Array.isArray(regexScript.trimStrings) && regexScript.trimStrings.length > 0) {
                    regexScript.trimStrings.forEach(trimStr => {
                        if (trimStr) {
                            capturedMatch = capturedMatch.replaceAll(trimStr, '');
                        }
                    });
                }

                return capturedMatch;
            });

            return result;
        });

        console.info(`Regex script "${regexScript.scriptName}" processed:`, {
            original: rawString.substring(0, 100) + (rawString.length > 100 ? '...' : ''),
            result: newString.substring(0, 100) + (newString.length > 100 ? '...' : ''),
            originalLength: rawString.length,
            resultLength: newString.length,
            findRegex: regexScript.findRegex,
            replaceString: regexScript.replaceString || '(empty - will delete matches)',
        });

        return newString;
    } catch (error) {
        console.error(`Error running regex script "${regexScript.scriptName}":`, error);
        return rawString;
    }
}

/**
 * 按顺序执行多个正则脚本
 * @param {RegexScript[]} scripts - 正则脚本数组
 * @param {string} rawString - 要处理的原始字符串
 * @returns {string} 处理后的字符串
 */
export function runRegexScripts(scripts, rawString) {
    if (!Array.isArray(scripts) || scripts.length === 0) {
        return rawString || '';
    }

    let result = rawString;
    const originalLength = rawString.length;
    
    for (const script of scripts) {
        if (script && !script.disabled) {
            const beforeLength = result.length;
            result = runRegexScript(script, result);
            const afterLength = result.length;
            
            // 如果脚本导致文本长度大幅减少，给出警告
            if (beforeLength > 0 && afterLength === 0) {
                console.warn(`⚠️ Script "${script.scriptName}" cleared all text! Original: ${beforeLength} chars → Result: ${afterLength} chars`);
            } else if (beforeLength > 0 && afterLength < beforeLength * 0.1) {
                console.warn(`⚠️ Script "${script.scriptName}" removed most text! Original: ${beforeLength} chars → Result: ${afterLength} chars`);
            }
        }
    }
    
    // 最终检查
    if (originalLength > 0 && result.length === 0) {
        console.error('🚨 All regex scripts combined resulted in empty text!');
        console.error('Consider checking your regex scripts with debugRegexScripts()');
    }

    return result;
}

/**
 * 验证正则脚本的有效性
 * @param {Object} script - 要验证的脚本对象
 * @returns {{valid: boolean, errors: string[]}} 验证结果
 */
export function validateRegexScript(script) {
    const errors = [];

    if (!script) {
        errors.push('脚本对象为空');
        return { valid: false, errors };
    }

    if (!script.scriptName || typeof script.scriptName !== 'string') {
        errors.push('脚本名称无效或为空');
    }

    if (!script.findRegex || typeof script.findRegex !== 'string') {
        errors.push('查找正则表达式为空');
    } else {
        // 验证正则表达式语法
        const regex = regexFromString(script.findRegex);
        if (!regex) {
            errors.push('查找正则表达式语法错误');
        }
    }

    return {
        valid: errors.length === 0,
        errors: errors,
    };
}

/**
 * 创建一个空的正则脚本模板
 * @returns {RegexScript} 正则脚本模板
 */
export function createEmptyRegexScript() {
    return {
        id: generateUUID(),
        scriptName: '',
        findRegex: '',
        replaceString: '',
        trimStrings: [],
        disabled: false,
        substituteRegex: 0,
    };
}

/**
 * 生成简单的UUID
 * @returns {string} UUID字符串
 */
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

