import { cancelTtsPlay, eventSource, event_types, getCurrentChatId, isStreamingEnabled, name2, saveSettingsDebounced, substituteParams } from '/script.js';
import { ModuleWorkerWrapper, doExtrasFetch, extension_settings, getApiUrl, getContext, modules, renderExtensionTemplateAsync } from '/scripts/extensions.js';
import { delay, escapeRegex, getBase64Async, getStringHash, onlyUnique } from '/scripts/utils.js';
import { EdgeTtsProvider } from './edge.js';
import { ElevenLabsTtsProvider } from './elevenlabs.js';
import { SileroTtsProvider } from './silerotts.js';
import { GptSovitsV2Provider } from './gpt-sovits-v2.js';
import { CoquiTtsProvider } from './coqui.js';
import { SystemTtsProvider } from './system.js';
import { NovelTtsProvider } from './novel.js';
import { power_user } from '/scripts/power-user.js';
import { OpenAITtsProvider } from './openai.js';
import { OpenAICompatibleTtsProvider } from './openai-compatible.js';
import { XTTSTtsProvider } from './xtts.js';
import { VITSTtsProvider } from './vits.js';
import { GSVITtsProvider } from './gsvi.js';
import { SBVits2TtsProvider } from './sbvits2.js';
import { AllTalkTtsProvider } from './alltalk.js';
import { CosyVoiceProvider } from './cosyvoice.js';
import { SpeechT5TtsProvider } from './speecht5.js';
import { AzureTtsProvider } from './azure.js';
import { SlashCommandParser } from '/scripts/slash-commands/SlashCommandParser.js';
import { SlashCommand } from '/scripts/slash-commands/SlashCommand.js';
import { ARGUMENT_TYPE, SlashCommandArgument, SlashCommandNamedArgument } from '/scripts/slash-commands/SlashCommandArgument.js';
import { debounce_timeout } from '/scripts/constants.js';
import { SlashCommandEnumValue, enumTypes } from '/scripts/slash-commands/SlashCommandEnumValue.js';
import { enumIcons } from '/scripts/slash-commands/SlashCommandCommonEnumsProvider.js';
import { POPUP_TYPE, callGenericPopup } from '/scripts/popup.js';
import { GoogleTranslateTtsProvider } from './google-translate.js';
export { talkingAnimation };

const UPDATE_INTERVAL = 1000;

let voiceMapEntries = [];
let voiceMap = {}; // {charName:voiceid, charName2:voiceid2}
let talkingHeadState = false;
let lastChatId = null;
let lastMessage = null;
let lastMessageHash = null;
let periodicMessageGenerationTimer = null;
let lastPositionOfParagraphEnd = -1;
let currentInitVoiceMapPromise = null;

// 悬浮按钮位置管理全局变量
let floatingButtonCurrentTransform = ''; // 保存当前的transform值
let floatingButtonHasCustomPosition = false; // 是否有自定义位置

// 悬浮按钮位置监控器
let floatingButtonObserver = null;

/**
 * 调试悬浮按钮状态
 */
function debugFloatingButtonState() {
    const button = $('#tts_floating_button');
    if (button.length) {
        const element = button[0];
        console.group('Floating Button Debug Info');
        console.log('Element classes:', element.className);
        console.log('Inline style transform:', element.style.transform);
        console.log('Computed style transform:', window.getComputedStyle(element).transform);
        console.log('Computed style animation:', window.getComputedStyle(element).animation);
        console.log('Expected transform:', floatingButtonCurrentTransform);
        console.log('Has custom position:', floatingButtonHasCustomPosition);
        console.groupEnd();
    }
}

// 暴露调试函数到全局
window.debugFloatingButtonState = debugFloatingButtonState;

/**
 * 强制修复悬浮按钮位置的调试函数
 */
window.forceFixFloatingButtonPosition = function() {
    const button = $('#tts_floating_button');
    if (button.length) {
        const element = button[0];
        
        console.group('🔧 Force Fixing Floating Button Position');
        
        // 强制设置自定义位置状态
        floatingButtonHasCustomPosition = true;
        floatingButtonCurrentTransform = floatingButtonCurrentTransform || 'translate(100px, 100px)';
        
        // 添加CSS类
        button.addClass('has-custom-position');
        
        // 强制设置所有样式
        element.style.setProperty('position', 'fixed', 'important');
        element.style.setProperty('left', '0px', 'important');
        element.style.setProperty('top', '0px', 'important');
        element.style.setProperty('right', 'auto', 'important');
        element.style.setProperty('bottom', 'auto', 'important');
        element.style.setProperty('transform', floatingButtonCurrentTransform, 'important');
        element.style.setProperty('transition', 'none', 'important');
        element.style.setProperty('animation', 'none', 'important');
        
        console.log('✅ Position forcefully fixed:', {
            transform: floatingButtonCurrentTransform,
            hasClass: button.hasClass('has-custom-position'),
            computedTransform: window.getComputedStyle(element).transform
        });
        
        console.groupEnd();
    }
};

/**
 * 全局调试函数 - 显示完整的悬浮按钮状态
 */
window.debugFloatingButtonComplete = function() {
    const button = $('#tts_floating_button');
    if (button.length) {
        const element = button[0];
        const computedStyle = window.getComputedStyle(element);
        
        console.group('🔍 Complete Floating Button Debug Info');
        console.log('📱 Device Info:', {
            isMobile: isMobileDevice(),
            windowWidth: window.innerWidth,
            windowHeight: window.innerHeight,
            userAgent: navigator.userAgent
        });
        console.log('🎯 Position State:', {
            hasCustomPosition: floatingButtonHasCustomPosition,
            currentTransform: floatingButtonCurrentTransform
        });
        console.log('🎨 Element Classes:', element.className.split(' '));
        console.log('📐 Inline Styles:', {
            position: element.style.position,
            left: element.style.left,
            top: element.style.top,
            right: element.style.right,
            bottom: element.style.bottom,
            transform: element.style.transform
        });
        console.log('💻 Computed Styles:', {
            position: computedStyle.position,
            left: computedStyle.left,
            top: computedStyle.top,
            right: computedStyle.right,
            bottom: computedStyle.bottom,
            transform: computedStyle.transform
        });
        console.log('📏 Element Rect:', element.getBoundingClientRect());
        console.groupEnd();
    } else {
        console.warn('Floating button not found!');
    }
};

/**
 * 统一的移动端检测函数
 */
function isMobileDevice() {
    const isMobile = window.innerWidth <= 768 || 
           /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    console.debug('Mobile device detection:', {
        windowWidth: window.innerWidth,
        userAgent: navigator.userAgent,
        isMobile: isMobile
    });
    return isMobile;
}

/**
 * 全局的悬浮按钮位置保存函数
 */
function preserveFloatingButtonPosition() {
    const button = $('#tts_floating_button');
    if (button.length) {
        const element = button[0];
        
        console.debug('preserveFloatingButtonPosition called:', {
            hasCustomPosition: floatingButtonHasCustomPosition,
            currentTransform: floatingButtonCurrentTransform,
            elementClasses: element.className,
            currentStyle: {
                position: element.style.position,
                left: element.style.left,
                top: element.style.top,
                transform: element.style.transform
            }
        });
        
        // 如果有自定义位置，保存自定义位置
        if (floatingButtonHasCustomPosition && floatingButtonCurrentTransform) {
            console.debug(`Preserving custom position: ${floatingButtonCurrentTransform}`);
            
            // 首先添加CSS类
            button.addClass('has-custom-position');
            
            // 强制设置所有定位相关属性，使用setProperty确保优先级
            element.style.setProperty('position', 'fixed', 'important');
            element.style.setProperty('left', '0px', 'important');
            element.style.setProperty('top', '0px', 'important');
            element.style.setProperty('right', 'auto', 'important');
            element.style.setProperty('bottom', 'auto', 'important');
            element.style.setProperty('transform', floatingButtonCurrentTransform, 'important');
            element.style.setProperty('transition', 'none', 'important');
            element.style.setProperty('animation', 'none', 'important');
            
            // 强制重绘，确保位置立即生效
            element.offsetHeight;
            
            // 暂时禁用位置监控器，避免无限循环
            // startPositionMonitor(element);
            
            console.debug('Custom position applied:', {
                transform: element.style.transform,
                hasClass: button.hasClass('has-custom-position')
            });
        } else {
            // 如果没有自定义位置，确保使用默认的居中位置
            const isMobile = isMobileDevice();
            
            console.debug('Preserving default position for', isMobile ? 'mobile' : 'desktop');
            
            // 移除自定义位置类，避免CSS冲突
            button.removeClass('has-custom-position');
            
            element.style.position = 'fixed';
            element.style.right = 'auto';
            element.style.bottom = 'auto';
            element.style.left = '20px';
            
            if (isMobile) {
                // 移动端：使用vh单位和强制优先级
                element.style.setProperty('top', '50vh', 'important');
                element.style.setProperty('transform', 'translateY(-50%)', 'important');
                element.style.setProperty('left', '20px', 'important');
            } else {
                // PC端：使用百分比定位
                element.style.top = '50%';
                element.style.transform = 'translateY(-50%)';
            }
            
            console.debug('Default position applied:', {
                left: element.style.left,
                top: element.style.top,
                transform: element.style.transform,
                hasClass: button.hasClass('has-custom-position')
            });
        }
    }
}

/**
 * 启动悬浮按钮位置监控器
 */
function startPositionMonitor(element) {
    // 停止之前的监控器
    if (floatingButtonObserver) {
        floatingButtonObserver.disconnect();
    }
    
    // 创建新的监控器
    floatingButtonObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                const currentTransform = element.style.transform;
                if (currentTransform !== floatingButtonCurrentTransform && floatingButtonCurrentTransform) {
                    console.warn('Position was overridden by mutation, restoring:', floatingButtonCurrentTransform);
                    element.style.transform = floatingButtonCurrentTransform;
                }
            }
        });
    });
    
    // 开始监控样式变化
    floatingButtonObserver.observe(element, {
        attributes: true,
        attributeFilter: ['style']
    });
    
    // 暂时禁用定时检查，避免疯狂循环
    // TODO: 重新启用定时检查，当找到根本原因后
    /*
    const intervalCheck = setInterval(() => {
        if (!floatingButtonHasCustomPosition) {
            clearInterval(intervalCheck);
            return;
        }
        
        const currentTransform = element.style.transform;
        if (currentTransform !== floatingButtonCurrentTransform && floatingButtonCurrentTransform) {
            console.warn('Position was overridden by interval check!');
            console.warn('Expected:', floatingButtonCurrentTransform);
            console.warn('Actual:', currentTransform);
            console.warn('Element classes:', element.className);
            console.warn('Computed style transform:', window.getComputedStyle(element).transform);
            element.style.transform = floatingButtonCurrentTransform;
        }
    }, 100);
    
    setTimeout(() => {
        clearInterval(intervalCheck);
    }, 10000);
    */
}

const DEFAULT_VOICE_MARKER = '[Default Voice]';
const DISABLED_VOICE_MARKER = 'disabled';

export function getPreviewString(lang) {
    const previewStrings = {
        'en-US': 'The quick brown fox jumps over the lazy dog',
        'en-GB': 'Sphinx of black quartz, judge my vow',
        'fr-FR': 'Portez ce vieux whisky au juge blond qui fume',
        'de-DE': 'Victor jagt zwölf Boxkämpfer quer über den großen Sylter Deich',
        'it-IT': 'Pranzo d\'acqua fa volti sghembi',
        'es-ES': 'Quiere la boca exhausta vid, kiwi, piña y fugaz jamón',
        'es-MX': 'Fabio me exige, sin tapujos, que añada cerveza al whisky',
        'ru-RU': 'В чащах юга жил бы цитрус? Да, но фальшивый экземпляр!',
        'pt-BR': 'Vejo xá gritando que fez show sem playback.',
        'pt-PR': 'Todo pajé vulgar faz boquinha sexy com kiwi.',
        'uk-UA': 'Фабрикуймо гідність, лящім їжею, ґав хапаймо, з\'єднавці чаш!',
        'pl-PL': 'Pchnąć w tę łódź jeża lub ośm skrzyń fig',
        'cs-CZ': 'Příliš žluťoučký kůň úpěl ďábelské ódy',
        'sk-SK': 'Vyhŕňme si rukávy a vyprážajme čínske ryžové cestoviny',
        'hu-HU': 'Árvíztűrő tükörfúrógép',
        'tr-TR': 'Pijamalı hasta yağız şoföre çabucak güvendi',
        'nl-NL': 'De waard heeft een kalfje en een pinkje opgegeten',
        'sv-SE': 'Yxskaftbud, ge vårbygd, zinkqvarn',
        'da-DK': 'Quizdeltagerne spiste jordbær med fløde, mens cirkusklovnen Walther spillede på xylofon',
        'ja-JP': 'いろはにほへと　ちりぬるを　わかよたれそ　つねならむ　うゐのおくやま　けふこえて　あさきゆめみし　ゑひもせす',
        'ko-KR': '가나다라마바사아자차카타파하',
        'zh-CN': '我能吞下玻璃而不伤身体',
        'ro-RO': 'Muzicologă în bej vând whisky și tequila, preț fix',
        'bg-BG': 'Щъркелите се разпръснаха по цялото небе',
        'el-GR': 'Ταχίστη αλώπηξ βαφής ψημένη γη, δρασκελίζει υπέρ νωθρού κυνός',
        'fi-FI': 'Voi veljet, miksi juuri teille myin nämä vehkeet?',
        'he-IL': 'הקצינים צעקו: "כל הכבוד לצבא הצבאות!"',
        'id-ID': 'Jangkrik itu memang enak, apalagi kalau digoreng',
        'ms-MY': 'Muzik penyanyi wanita itu menggambarkan kehidupan yang penuh dengan duka nestapa',
        'th-TH': 'เป็นไงบ้างครับ ผมชอบกินข้าวผัดกระเพราหมูกรอบ',
        'vi-VN': 'Cô bé quàng khăn đỏ đang ngồi trên bãi cỏ xanh',
        'ar-SA': 'أَبْجَدِيَّة عَرَبِيَّة',
        'hi-IN': 'श्वेता ने श्वेता के श्वेते हाथों में श्वेता का श्वेता चावल पकड़ा',
    };
    const fallbackPreview = 'Neque porro quisquam est qui dolorem ipsum quia dolor sit amet';

    return previewStrings[lang] ?? fallbackPreview;
}

const ttsProviders = {
    AllTalk: AllTalkTtsProvider,
    Azure: AzureTtsProvider,
    Coqui: CoquiTtsProvider,
    'CosyVoice (Unofficial)': CosyVoiceProvider,
    Edge: EdgeTtsProvider,
    ElevenLabs: ElevenLabsTtsProvider,
    'Google Translate': GoogleTranslateTtsProvider,
    GSVI: GSVITtsProvider,
    'GPT-SoVITS-V2 (Unofficial)': GptSovitsV2Provider,
    Novel: NovelTtsProvider,
    OpenAI: OpenAITtsProvider,
    'OpenAI Compatible': OpenAICompatibleTtsProvider,
    SBVits2: SBVits2TtsProvider,
    Silero: SileroTtsProvider,
    SpeechT5: SpeechT5TtsProvider,
    System: SystemTtsProvider,
    VITS: VITSTtsProvider,
    XTTSv2: XTTSTtsProvider,
};
let ttsProvider;
let ttsProviderName;


async function onNarrateOneMessage() {
    audioElement.src = '/sounds/silence.mp3';
    const context = getContext();
    const id = $(this).closest('.mes').attr('mesid');
    const message = context.chat[id];

    if (!message) {
        return;
    }

    resetTtsPlayback();
    processAndQueueTtsMessage(message);
    moduleWorker();
}

async function onNarrateText(args, text) {
    if (!text) {
        return '';
    }

    audioElement.src = '/sounds/silence.mp3';

    // To load all characters in the voice map, set unrestricted to true
    await initVoiceMap(true);

    const baseName = args?.voice || name2;
    const name = (baseName === 'SillyTavern System' ? DEFAULT_VOICE_MARKER : baseName) || DEFAULT_VOICE_MARKER;

    const voiceMapEntry = voiceMap[name] === DEFAULT_VOICE_MARKER
        ? voiceMap[DEFAULT_VOICE_MARKER]
        : voiceMap[name];

    if (!voiceMapEntry || voiceMapEntry === DISABLED_VOICE_MARKER) {
        toastr.info(`Specified voice for ${name} was not found. Check the TTS extension settings.`);
        return;
    }

    resetTtsPlayback();
    processAndQueueTtsMessage({ mes: text, name: name });
    await moduleWorker();

    // Return back to the chat voices
    await initVoiceMap(false);
    return '';
}

async function moduleWorker() {
    if (!extension_settings.SillyTavernTTS.enabled) {
        return;
    }

    processTtsQueue();
    processAudioJobQueue();
    updateUiAudioPlayState();
}

function talkingAnimation(switchValue) {
    if (!modules.includes('talkinghead')) {
        console.debug('Talking Animation module not loaded');
        return;
    }

    const apiUrl = getApiUrl();
    const animationType = switchValue ? 'start' : 'stop';

    if (switchValue !== talkingHeadState) {
        try {
            console.log(animationType + ' Talking Animation');
            doExtrasFetch(`${apiUrl}/api/talkinghead/${animationType}_talking`);
            talkingHeadState = switchValue;
        } catch (error) {
            // Handle the error here or simply ignore it to prevent logging
        }
    }
    updateUiAudioPlayState();
}

function resetTtsPlayback() {
    // Stop system TTS utterance
    cancelTtsPlay();

    // Clear currently processing jobs
    currentTtsJob = null;
    currentAudioJob = null;

    // Reset audio element
    audioElement.currentTime = 0;
    audioElement.src = '';

    // Clear any queue items
    ttsJobQueue.splice(0, ttsJobQueue.length);
    audioJobQueue.splice(0, audioJobQueue.length);

    // Set audio ready to process again
    audioQueueProcessorReady = true;
}

function isTtsProcessing() {
    let processing = false;

    // Check job queues
    if (ttsJobQueue.length > 0 || audioJobQueue.length > 0) {
        processing = true;
    }
    // Check current jobs
    if (currentTtsJob != null || currentAudioJob != null) {
        processing = true;
    }
    return processing;
}

/**
 * Splits a message into lines and adds each non-empty line to the TTS job queue.
 * @param {Object} message - The message object to be processed.
 * @param {string} message.mes - The text of the message to be split into lines.
 * @param {string} message.name - The name associated with the message.
 * @returns {void}
 */
function processAndQueueTtsMessage(message) {
    if (!extension_settings.SillyTavernTTS.narrate_by_paragraphs) {
        ttsJobQueue.push(message);
        return;
    }

    const lines = message.mes.split('\n');

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (line.length === 0) {
            continue;
        }

        ttsJobQueue.push(
            Object.assign({}, message, {
                mes: line,
            }),
        );
    }
}

function debugTtsPlayback() {
    console.log(JSON.stringify(
        {
            'ttsProviderName': ttsProviderName,
            'voiceMap': voiceMap,
            'audioPaused': audioPaused,
            'audioJobQueue': audioJobQueue,
            'currentAudioJob': currentAudioJob,
            'audioQueueProcessorReady': audioQueueProcessorReady,
            'ttsJobQueue': ttsJobQueue,
            'currentTtsJob': currentTtsJob,
            'ttsConfig': extension_settings.SillyTavernTTS,
        },
    ));
}
window['debugTtsPlayback'] = debugTtsPlayback;

//##################//
//   Audio Control  //
//##################//

let audioElement = new Audio();
audioElement.id = 'tts_audio';
audioElement.autoplay = true;

/**
 * @type AudioJob[] Audio job queue
 * @typedef {{audioBlob: Blob | string, char: string}} AudioJob Audio job object
 */
let audioJobQueue = [];
/**
 * @type AudioJob Current audio job
 */
let currentAudioJob;
let audioPaused = false;
let audioQueueProcessorReady = true;

/**
 * Play audio data from audio job object.
 * @param {AudioJob} audioJob Audio job object
 * @returns {Promise<void>} Promise that resolves when audio playback is started
 */
async function playAudioData(audioJob) {
    const { audioBlob, char } = audioJob;
    // Since current audio job can be cancelled, don't playback if it is null
    if (currentAudioJob == null) {
        console.log('Cancelled TTS playback because currentAudioJob was null');
    }
    if (audioBlob instanceof Blob) {
        const srcUrl = await getBase64Async(audioBlob);

        // VRM lip sync
        if (extension_settings.vrm?.enabled && typeof window['vrmLipSync'] === 'function') {
            await window['vrmLipSync'](audioBlob, char);
        }

        audioElement.src = srcUrl;
    } else if (typeof audioBlob === 'string') {
        audioElement.src = audioBlob;
    } else {
        throw `TTS received invalid audio data type ${typeof audioBlob}`;
    }
    audioElement.addEventListener('ended', completeCurrentAudioJob);
    audioElement.addEventListener('canplay', () => {
        console.debug('Starting TTS playback');
        audioElement.playbackRate = extension_settings.SillyTavernTTS.playback_rate;
        audioElement.play();
    });
}

window['tts_preview'] = function (id) {
    const audio = document.getElementById(id);

    if (audio instanceof HTMLAudioElement && !$(audio).data('disabled')) {
        audio.play();
    }
    else {
        ttsProvider.previewTtsVoice(id);
    }
};

async function onTtsVoicesClick() {
    let popupText = '';

    try {
        const voiceIds = await ttsProvider.fetchTtsVoiceObjects();

        for (const voice of voiceIds) {
            popupText += `
            <div class="voice_preview">
                <span class="voice_lang">${voice.lang || ''}</span>
                <b class="voice_name">${voice.name}</b>
                <i onclick="tts_preview('${voice.voice_id}')" class="fa-solid fa-play"></i>
            </div>`;
            if (voice.preview_url) {
                popupText += `<audio id="${voice.voice_id}" src="${voice.preview_url}" data-disabled="${voice.preview_url == false}"></audio>`;
            }
        }
    } catch {
        popupText = 'Could not load voices list. Check your API key.';
    }

    callGenericPopup(popupText, POPUP_TYPE.TEXT, '', { allowVerticalScrolling: true });
}

function updateUiAudioPlayState() {
    if (extension_settings.SillyTavernTTS.enabled == true) {
        $('#ttsExtensionMenuItem').show();
        let img;
        // Give user feedback that TTS is active by setting the stop icon if processing or playing
        if (!audioElement.paused || isTtsProcessing()) {
            img = 'fa-solid fa-stop-circle extensionsMenuExtensionButton';
        } else {
            img = 'fa-solid fa-circle-play extensionsMenuExtensionButton';
        }
        $('#tts_media_control').attr('class', img);
    } else {
        $('#ttsExtensionMenuItem').hide();
    }
}

function onAudioControlClicked() {
    audioElement.src = '/sounds/silence.mp3';
    let context = getContext();
    // Not pausing, doing a full stop to anything TTS is doing. Better UX as pause is not as useful
    if (!audioElement.paused || isTtsProcessing()) {
        resetTtsPlayback();
        talkingAnimation(false);
    } else {
        // Default play behavior if not processing or playing is to play the last message.
        processAndQueueTtsMessage(context.chat[context.chat.length - 1]);
    }
    updateUiAudioPlayState();
}

function addAudioControl() {
    $('#tts_wand_container').append(`
        <div id="ttsExtensionMenuItem" class="list-group-item flex-container flexGap5">
            <div id="tts_media_control" class="extensionsMenuExtensionButton "/></div>
            TTS Playback
        </div>`);
    $('#tts_wand_container').append(`
        <div id="ttsExtensionNarrateAll" class="list-group-item flex-container flexGap5">
            <div class="extensionsMenuExtensionButton fa-solid fa-radio"></div>
            Narrate All Chat
        </div>`);
    $('#ttsExtensionMenuItem').attr('title', 'TTS play/pause').on('click', onAudioControlClicked);
    $('#ttsExtensionNarrateAll').attr('title', 'Narrate all messages in the current chat. Includes user messages, excludes hidden comments.').on('click', playFullConversation);
    updateUiAudioPlayState();
    
    // 添加悬浮按钮
    addFloatingTtsButton();
}

function completeCurrentAudioJob() {
    audioQueueProcessorReady = true;
    currentAudioJob = null;
    talkingAnimation(false); //stop lip animation
    // updateUiPlayState();
}

/**
 * Accepts an HTTP response containing audio/mpeg data, and puts the data as a Blob() on the queue for playback
 * @param {Response} response
 */
async function addAudioJob(response, char) {
    if (typeof response === 'string') {
        audioJobQueue.push({ audioBlob: response, char: char });
    } else {
        const audioData = await response.blob();
        if (!audioData.type.startsWith('audio/')) {
            throw `TTS received HTTP response with invalid data format. Expecting audio/*, got ${audioData.type}`;
        }
        audioJobQueue.push({ audioBlob: audioData, char: char });
    }
    console.debug('Pushed audio job to queue.');
}

async function processAudioJobQueue() {
    // Nothing to do, audio not completed, or audio paused - stop processing.
    if (audioJobQueue.length == 0 || !audioQueueProcessorReady || audioPaused) {
        return;
    }
    try {
        audioQueueProcessorReady = false;
        currentAudioJob = audioJobQueue.shift();
        playAudioData(currentAudioJob);
        talkingAnimation(true);
    } catch (error) {
        toastr.error(error.toString());
        console.error(error);
        audioQueueProcessorReady = true;
    }
}

//################//
//  TTS Control   //
//################//

let ttsJobQueue = [];
let currentTtsJob; // Null if nothing is currently being processed

function completeTtsJob() {
    console.info(`Current TTS job for ${currentTtsJob?.name} completed.`);
    currentTtsJob = null;
}

async function tts(text, voiceId, char) {
    async function processResponse(response) {
        // RVC injection
        if (typeof window['rvcVoiceConversion'] === 'function' && extension_settings.rvc.enabled)
            response = await window['rvcVoiceConversion'](response, char, text);

        await addAudioJob(response, char);
    }

    let response = await ttsProvider.generateTts(text, voiceId);

    // If async generator, process every chunk as it comes in
    if (typeof response[Symbol.asyncIterator] === 'function') {
        for await (const chunk of response) {
            await processResponse(chunk);
        }
    } else {
        await processResponse(response);
    }

    completeTtsJob();
}

async function processTtsQueue() {
    // Called each moduleWorker iteration to pull chat messages from queue
    if (currentTtsJob || ttsJobQueue.length <= 0 || audioPaused) {
        return;
    }

    console.debug('New message found, running TTS');
    currentTtsJob = ttsJobQueue.shift();
    let text = extension_settings.SillyTavernTTS.narrate_translated_only ? (currentTtsJob?.extra?.display_text || currentTtsJob.mes) : currentTtsJob.mes;

    // Substitute macros
    text = substituteParams(text);

    // 从文本中提取标签内容（在所有其他处理之前）
    text = extractTextFromTags(text);

    if (extension_settings.SillyTavernTTS.skip_codeblocks) {
        text = text.replace(/^\s{4}.*$/gm, '').trim();
        text = text.replace(/```.*?```/gs, '').trim();
    }

    if (extension_settings.SillyTavernTTS.skip_tags) {
        text = text.replace(/<.*?>.*?<\/.*?>/g, '').trim();
    }

    if (!extension_settings.SillyTavernTTS.pass_asterisks) {
        text = extension_settings.SillyTavernTTS.narrate_dialogues_only
            ? text.replace(/\*[^*]*?(\*|$)/g, '').trim() // remove asterisks content
            : text.replaceAll('*', '').trim(); // remove just the asterisks
    }

    if (extension_settings.SillyTavernTTS.narrate_quoted_only) {
        const special_quotes = /[“”«»「」『』＂＂]/g; // Extend this regex to include other special quotes
        text = text.replace(special_quotes, '"');
        const matches = text.match(/".*?"/g); // Matches text inside double quotes, non-greedily
        const partJoiner = (ttsProvider?.separator || ' ... ');
        text = matches ? matches.join(partJoiner) : text;
    }

    // Remove embedded images
    text = text.replace(/!\[.*?]\([^)]*\)/g, '');

    if (typeof ttsProvider?.processText === 'function') {
        text = await ttsProvider.processText(text);
    }

    // Collapse newlines and spaces into single space
    text = text.replace(/\s+/g, ' ').trim();

    console.log(`TTS: ${text}`);
    const char = currentTtsJob.name;

    // Remove character name from start of the line if power user setting is disabled
    if (char && !power_user.allow_name2_display) {
        const escapedChar = escapeRegex(char);
        text = text.replace(new RegExp(`^${escapedChar}:`, 'gm'), '');
    }

    try {
        if (!text) {
            console.warn('Got empty text in TTS queue job.');
            completeTtsJob();
            return;
        }

        const voiceMapEntry = voiceMap[char] === DEFAULT_VOICE_MARKER ? voiceMap[DEFAULT_VOICE_MARKER] : voiceMap[char];

        if (!voiceMapEntry || voiceMapEntry === DISABLED_VOICE_MARKER) {
            throw `${char} not in voicemap. Configure character in extension settings voice map`;
        }
        const voice = await ttsProvider.getVoice(voiceMapEntry);
        const voiceId = voice.voice_id;
        if (voiceId == null) {
            toastr.error(`Specified voice for ${char} was not found. Check the TTS extension settings.`);
            throw `Unable to attain voiceId for ${char}`;
        }
        await tts(text, voiceId, char);
    } catch (error) {
        toastr.error(error.toString());
        console.error(error);
        currentTtsJob = null;
        
        // 重置悬浮球状态为默认状态（蓝色）
        const button = $('#tts_floating_button');
        if (button.length) {
            button.removeClass('playing paused');
            updateFloatingButtonIcon('default');
            // 确保位置不变 - 使用延迟确保DOM更新完成
            setTimeout(() => {
                preserveFloatingButtonPosition();
            }, 10);
        }
        audioPaused = false;
        
        // 停止音频播放状态
        audioElement.currentTime = 0;
        audioElement.src = '';
        
        console.info('TTS generation failed, floating button reset to default state');
    }
}

async function playFullConversation() {
    resetTtsPlayback();

    if (!extension_settings.SillyTavernTTS.enabled) {
        return toastr.warning('TTS is disabled. Please enable it in the extension settings.');
    }

    const context = getContext();
    const chat = context.chat.filter(x => !x.is_system && x.mes !== '...' && x.mes !== '');

    if (chat.length === 0) {
        return toastr.info('No messages to narrate.');
    }

    ttsJobQueue = chat;
}

window['playFullConversation'] = playFullConversation;

//#############################//
//  Text Tag Extraction        //
//#############################//

/**
 * 从文本中提取指定标签的内容
 * @param {string} text - 包含HTML标签的文本
 * @returns {string} - 提取的纯文本内容
 */
function extractTextFromTags(text) {
    if (!text) return '';
    
    // 获取设置
    const customTags = extension_settings.SillyTavernTTS.custom_extraction_tag || '';
    const extractFromAudio = extension_settings.SillyTavernTTS.extract_from_audio_tag;
    
    let extractedText = '';
    
    // 优先级1：如果设置了自定义标签，从自定义标签中提取（支持多个标签，用逗号分隔）
    if (customTags) {
        const tagList = customTags.split(',').map(tag => tag.trim()).filter(tag => tag);
        let allMatches = [];
        
        for (const tag of tagList) {
            const tagContent = extractFromSpecificTag(text, tag);
            if (tagContent.length > 0) {
                allMatches.push(...tagContent);
                console.info(`Extracted text from custom tag <${tag}>: "${tagContent.join(', ')}"`);
            }
        }
        
        if (allMatches.length > 0) {
            extractedText = allMatches.join(' ');
        } else {
            console.warn(`Custom tags [${customTags}] not found, falling back to default extraction`);
        }
    }
    
    // 优先级2：如果启用了audio标签提取且没有从自定义标签获取到文本
    if (!extractedText && extractFromAudio) {
        const audioContent = extractFromSpecificTag(text, 'audio');
        if (audioContent.length > 0) {
            extractedText = audioContent.join(' ');
            console.info(`Extracted text from <audio> tag: "${extractedText}"`);
        }
    }
    
    // 如果以上方法都没有获取到文本，使用原始文本
    if (!extractedText) {
        extractedText = text;
        console.info(`Using original text (no tag extraction): "${extractedText.substring(0, 100)}..."`);
    }
    
    // 清理HTML标签和多余的空白字符
    extractedText = extractedText.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    
    return extractedText;
}

/**
 * 从文本中提取指定标签的内容，正确处理嵌套标签
 * @param {string} text - 包含HTML标签的文本
 * @param {string} tagName - 标签名称（不包含尖括号）
 * @returns {string[]} - 提取的文本内容数组
 */
function extractFromSpecificTag(text, tagName) {
    const results = [];
    
    // 创建开始和结束标签的正则表达式
    const startTagRegex = new RegExp(`<${tagName}[^>]*>`, 'gi');
    const endTagRegex = new RegExp(`</${tagName}>`, 'gi');
    
    let searchPos = 0;
    
    while (searchPos < text.length) {
        // 查找下一个开始标签
        startTagRegex.lastIndex = searchPos;
        const startMatch = startTagRegex.exec(text);
        
        if (!startMatch) {
            break; // 没有更多开始标签
        }
        
        const startPos = startMatch.index;
        const contentStart = startPos + startMatch[0].length;
        
        // 从开始标签后查找匹配的结束标签，处理嵌套
        let depth = 1;
        let pos = contentStart;
        let contentEnd = -1;
        
        while (pos < text.length && depth > 0) {
            // 查找下一个开始或结束标签
            const nextStartRegex = new RegExp(`<${tagName}[^>]*>`, 'gi');
            const nextEndRegex = new RegExp(`</${tagName}>`, 'gi');
            
            nextStartRegex.lastIndex = pos;
            nextEndRegex.lastIndex = pos;
            
            const nextStart = nextStartRegex.exec(text);
            const nextEnd = nextEndRegex.exec(text);
            
            // 确定哪个标签更近
            let nextStartPos = nextStart ? nextStart.index : Infinity;
            let nextEndPos = nextEnd ? nextEnd.index : Infinity;
            
            if (nextStartPos < nextEndPos) {
                // 遇到嵌套的开始标签
                depth++;
                pos = nextStartPos + nextStart[0].length;
            } else if (nextEndPos < Infinity) {
                // 遇到结束标签
                depth--;
                if (depth === 0) {
                    contentEnd = nextEndPos;
                }
                pos = nextEndPos + nextEnd[0].length;
            } else {
                // 没有找到匹配的结束标签
                break;
            }
        }
        
        if (contentEnd !== -1) {
            // 提取标签内容
            const content = text.substring(contentStart, contentEnd);
            results.push(content);
            searchPos = contentEnd + `</${tagName}>`.length;
        } else {
            // 没有找到匹配的结束标签，跳过这个开始标签
            searchPos = contentStart;
        }
    }
    
    return results;
}

/**
 * 获取最后一个消息的内容
 * @returns {object|null} - 最后一个消息对象
 */
function getLastMessage() {
    const context = getContext();
    if (!context.chat || context.chat.length === 0) {
        console.warn('No messages found in chat');
        toastr.warning('聊天中没有找到消息');
        return null;
    }
    
    // 获取最后一个非系统消息
    for (let i = context.chat.length - 1; i >= 0; i--) {
        const message = context.chat[i];
        if (!message.is_system && message.mes && message.mes !== '...' && message.mes !== '') {
            console.info(`Found last message: "${message.mes.substring(0, 100)}..."`);
            return message;
        }
    }
    
    console.warn('No valid messages found');
    return null;
}

/**
 * 点击悬浮按钮时触发，播放/暂停最后一个消息的语音
 */
async function onFloatingButtonClick(event) {
    // 防止拖动时触发点击
    if (event.target.classList.contains('dragging')) {
        return;
    }
    
    if (!extension_settings.SillyTavernTTS.enabled) {
        toastr.warning('TTS 未启用，请在设置中启用 TTS');
        return;
    }
    
    const button = $('#tts_floating_button');
    
    // 检查是否正在播放或暂停
    const isPlaying = !audioElement.paused;
    const isPaused = audioPaused;
    const hasAudio = audioElement.src && audioElement.src !== '' && !audioElement.src.includes('silence.mp3');
    
    // 情况1: 正在播放 -> 暂停
    if (isPlaying && hasAudio) {
        console.debug('Pausing audio, current position:', floatingButtonCurrentTransform);
        audioElement.pause();
        audioPaused = true;
        button.removeClass('playing').addClass('paused');
        updateFloatingButtonIcon('pause');
        // 确保位置不变 - 使用延迟确保DOM更新完成
        setTimeout(() => {
            preserveFloatingButtonPosition();
            console.info('Audio paused, position preserved');
        }, 10);
        return;
    }
    
    // 情况2: 已暂停 -> 继续播放
    if (isPaused && hasAudio) {
        console.debug('Resuming audio, current position:', floatingButtonCurrentTransform);
        audioElement.play();
        audioPaused = false;
        button.removeClass('paused').addClass('playing');
        updateFloatingButtonIcon('play');
        // 确保位置不变 - 使用延迟确保DOM更新完成
        setTimeout(() => {
            preserveFloatingButtonPosition();
            console.info('Audio resumed, position preserved');
        }, 10);
        return;
    }
    
    // 情况3: 没有播放 -> 播放最新消息
    // 获取最后一个消息对象
    const message = getLastMessage();
    
    if (!message) {
        toastr.warning('没有找到可以朗读的消息');
        return;
    }

    console.info(`Floating button clicked, narrating message: "${message.mes.substring(0, 100)}..."`);

    try {
        // 停止当前播放
        resetTtsPlayback();

        // 初始化 voice map
        await initVoiceMap(false);

        // 添加到 TTS 队列
        processAndQueueTtsMessage(message);
        
        // 添加播放状态
        button.removeClass('paused').addClass('playing');
        updateFloatingButtonIcon('play');
        // 确保位置不变 - 使用延迟确保DOM更新完成
        setTimeout(() => {
            preserveFloatingButtonPosition();
        }, 10);
        
        // 开始处理
        await moduleWorker();
    } catch (error) {
        // 如果发生任何错误，重置悬浮球状态
        console.error('Error in floating button click handler:', error);
        toastr.error(`TTS播放失败: ${error.toString()}`);
        
        // 重置悬浮球状态为默认状态（蓝色）
        button.removeClass('playing paused');
        updateFloatingButtonIcon('default');
        // 确保位置不变 - 使用延迟确保DOM更新完成
        setTimeout(() => {
            preserveFloatingButtonPosition();
        }, 10);
        audioPaused = false;
        
        // 停止音频播放状态
        audioElement.currentTime = 0;
        audioElement.src = '';
    }
}

/**
 * 更新悬浮按钮图标
 * @param {string} state - 'play' 或 'pause'
 */
function updateFloatingButtonIcon(state) {
    const icon = $('#tts_floating_button i');
    if (state === 'play') {
        icon.removeClass('fa-volume-high fa-pause').addClass('fa-play');
    } else if (state === 'pause') {
        icon.removeClass('fa-volume-high fa-play').addClass('fa-pause');
    } else {
        // 默认状态
        icon.removeClass('fa-play fa-pause').addClass('fa-volume-high');
    }
}

/**
 * 添加可拖动的悬浮 TTS 按钮
 */
function addFloatingTtsButton() {
    // 创建悬浮按钮
    const floatingButton = $(`
        <div id="tts_floating_button" title="点击播放/暂停&#10;双击停止播放&#10;拖动可移动位置">
            <i class="fa-solid fa-volume-high"></i>
        </div>
    `);
    
    // 添加到 body
    $('body').append(floatingButton);
    
    // 使用全局的移动端检测函数
    
    // 设置初始位置的函数
    function setInitialPosition() {
        const element = floatingButton[0];
        element.style.position = 'fixed';
        element.style.right = 'auto';
        element.style.bottom = 'auto';
        element.style.left = '20px';
        
        if (isMobileDevice()) {
            // 移动端：使用vh单位和更强制的定位
            console.debug('Detected mobile device, using mobile positioning');
            element.style.top = '50vh';
            element.style.transform = 'translateY(-50%)';
            // 强制样式优先级
            element.style.setProperty('top', '50vh', 'important');
            element.style.setProperty('transform', 'translateY(-50%)', 'important');
            element.style.setProperty('left', '20px', 'important');
        } else {
            // PC端：使用百分比定位
            element.style.top = '50%';
            element.style.transform = 'translateY(-50%)';
        }
    }
    
    // 立即设置初始位置
    setInitialPosition();
    
    // 延迟再次设置，确保移动端页面完全加载
    setTimeout(() => {
        if (isMobileDevice()) {
            console.debug('Double-checking mobile position after DOM ready');
            setInitialPosition();
        }
    }, 500);
    
    // 监听窗口大小变化，重新检查定位
    $(window).on('resize.floatingButton orientationchange.floatingButton', function() {
        if (!floatingButtonHasCustomPosition) {
            setTimeout(() => {
                setInitialPosition();
            }, 100);
        }
    });
    
    // 拖动和交互相关变量
    let isDragging = false;
    let dragStarted = false; // 是否真正开始拖动
    let startX = 0;
    let startY = 0;
    let offsetX = 0;
    let offsetY = 0;
    
    // 双击相关变量
    let lastClickTime = 0;
    let clickTimeout = null;
    const DOUBLE_CLICK_DELAY = 300; // 双击判定时间（毫秒）
    
    // 位置保存变量（现在使用全局变量）
    // let currentTransform = ''; // 已移到全局
    // let hasCustomPosition = false; // 已移到全局
    
    // 统一的按下处理函数
    function handlePointerDown(clientX, clientY, element) {
        isDragging = true;
        dragStarted = false;
        
        // 获取指针相对于按钮的偏移
        const rect = element.getBoundingClientRect();
        offsetX = clientX - rect.left;
        offsetY = clientY - rect.top;
        
        startX = clientX;
        startY = clientY;
        
        console.debug('🎯 Pointer down detected:', {
            clientX, clientY,
            offsetX, offsetY,
            startX, startY,
            isDragging,
            dragStarted
        });
    }
    
    // 鼠标按下事件
    floatingButton.on('mousedown', function(e) {
        // 只处理左键点击
        if (e.which !== 1) return;
        
        handlePointerDown(e.clientX, e.clientY, this);
        e.preventDefault();
        e.stopPropagation();
    });
    
    // 触摸开始事件（移动端支持）
    floatingButton.on('touchstart', function(e) {
        console.debug('touchstart event:', {
            touchesLength: e.originalEvent.touches.length,
            touch: e.originalEvent.touches[0] ? {
                clientX: e.originalEvent.touches[0].clientX,
                clientY: e.originalEvent.touches[0].clientY
            } : null
        });
        
        // 确保只处理单点触摸
        if (e.originalEvent.touches.length !== 1) {
            console.debug('Ignoring multi-touch');
            return;
        }
        
        const touch = e.originalEvent.touches[0];
        handlePointerDown(touch.clientX, touch.clientY, this);
        
        // 阻止默认行为，防止页面滚动和其他触摸手势
        e.preventDefault();
        e.stopPropagation();
        
        // 阻止上下文菜单
        e.originalEvent.preventDefault();
        
        console.debug('touchstart handled successfully');
    });
    
    // 统一的移动处理函数
    function handlePointerMove(clientX, clientY) {
        if (!isDragging) return;
        
        const deltaX = clientX - startX;
        const deltaY = clientY - startY;
        
        // 如果移动超过 5px，认为是拖动
        if (!dragStarted && (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5)) {
            dragStarted = true;
            console.debug('🎯 Drag started!', { deltaX, deltaY });
            
            // 添加拖动样式
            floatingButton.addClass('dragging');
            $('body').css('user-select', 'none');
        }
        
        // 只有在真正拖动时才更新位置
        if (dragStarted) {
            // 计算新位置（指针位置减去偏移）
            let newX = clientX - offsetX;
            let newY = clientY - offsetY;
            
            // 限制在窗口范围内
            const buttonWidth = floatingButton.outerWidth();
            const buttonHeight = floatingButton.outerHeight();
            const maxX = window.innerWidth - buttonWidth;
            const maxY = window.innerHeight - buttonHeight;
            
            newX = Math.max(0, Math.min(newX, maxX));
            newY = Math.max(0, Math.min(newY, maxY));
            
            // 直接使用 transform 更新位置，性能最佳
            floatingButtonCurrentTransform = `translate(${newX}px, ${newY}px)`;
            floatingButtonHasCustomPosition = true; // 标记已有自定义位置
            
            const element = floatingButton[0];
            
            // 首先添加CSS类，确保样式优先级
            floatingButton.addClass('has-custom-position');
            
            // 强制设置所有定位属性，使用setProperty确保优先级
            element.style.setProperty('position', 'fixed', 'important');
            element.style.setProperty('left', '0px', 'important');
            element.style.setProperty('top', '0px', 'important');
            element.style.setProperty('right', 'auto', 'important');
            element.style.setProperty('bottom', 'auto', 'important');
            element.style.setProperty('transform', floatingButtonCurrentTransform, 'important');
            element.style.setProperty('transition', 'none', 'important');
            element.style.setProperty('animation', 'none', 'important');
            
            console.debug(`Updated floating button position: ${floatingButtonCurrentTransform}`, {
                newX, newY,
                elementStyle: {
                    left: element.style.left,
                    top: element.style.top,
                    transform: element.style.transform
                }
            });
        }
    }
    
    // 鼠标移动事件
    $(document).on('mousemove.floatingButton', function(e) {
        // 只有在拖拽时才处理
        if (!isDragging) return;
        handlePointerMove(e.clientX, e.clientY);
    });
    
    // 触摸移动事件（移动端支持）
    $(document).on('touchmove.floatingButton', function(e) {
        // 只有在开始拖拽时才处理事件（不需要等待dragStarted）
        if (!isDragging) return;
        
        // 确保只处理单点触摸
        if (e.originalEvent.touches.length !== 1) {
            console.debug('touchmove: Ignoring multi-touch');
            return;
        }
        
        const touch = e.originalEvent.touches[0];
        console.debug('touchmove event:', {
            clientX: touch.clientX,
            clientY: touch.clientY,
            isDragging: isDragging,
            dragStarted: dragStarted
        });
        
        handlePointerMove(touch.clientX, touch.clientY);
        
        // 只在真正开始拖拽后才阻止默认行为
        if (dragStarted) {
            e.preventDefault();
            e.stopPropagation();
            e.originalEvent.preventDefault();
        }
    });
    
    // 统一的释放处理函数
    function handlePointerUp(event) {
        if (!isDragging) return;
        
        const wasDragging = dragStarted;
        
        // 重置状态
        isDragging = false;
        dragStarted = false;
        
        // 移除拖动样式
        floatingButton.removeClass('dragging');
        $('body').css('user-select', '');
        
        // 如果没有拖动，处理点击/双击
        if (!wasDragging) {
            const currentTime = Date.now();
            const timeSinceLastClick = currentTime - lastClickTime;
            
            // 如果在双击判定时间内，则为双击
            if (timeSinceLastClick < DOUBLE_CLICK_DELAY && timeSinceLastClick > 0) {
                // 清除单击延迟
                if (clickTimeout) {
                    clearTimeout(clickTimeout);
                    clickTimeout = null;
                }
                
                // 双击操作：停止播放
                console.info('Double click detected, stopping audio');
                resetTtsPlayback();
                floatingButton.removeClass('playing paused');
                updateFloatingButtonIcon('default');
                audioPaused = false;
                // 确保位置不变 - 使用延迟确保DOM更新完成
                setTimeout(() => {
                    preserveFloatingButtonPosition();
                }, 10);
                toastr.info('已停止播放');
                
                // 重置时间，防止触发三次点击
                lastClickTime = 0;
            } else {
                // 单击操作：播放/暂停（延迟执行，等待双击判定）
                lastClickTime = currentTime;
                clickTimeout = setTimeout(() => {
                    onFloatingButtonClick(event);
                }, DOUBLE_CLICK_DELAY);
            }
        }
    }
    
    // 鼠标释放事件
    $(document).on('mouseup.floatingButton', function(e) {
        // 只有在拖拽时才处理
        if (isDragging) {
            handlePointerUp(e);
        }
    });
    
    // 触摸结束事件（移动端支持）
    $(document).on('touchend.floatingButton touchcancel.floatingButton', function(e) {
        // 只有在拖拽时才处理和阻止事件
        if (isDragging) {
            handlePointerUp(e);
            // 只在拖拽时才阻止默认行为
            e.preventDefault();
            e.stopPropagation();
        }
    });
    
    // 保存和恢复按钮位置的函数（已移到全局，这里保留兼容性）
    function preserveButtonPosition() {
        preserveFloatingButtonPosition();
    }
    
    // 监听音频开始播放事件
    audioElement.addEventListener('play', () => {
        console.debug('Audio play event triggered, preserving position:', floatingButtonCurrentTransform);
        const button = $('#tts_floating_button');
        if (button.length) {
            button.removeClass('paused').addClass('playing');
            updateFloatingButtonIcon('play');
            // 保持位置不变 - 使用延迟确保DOM更新完成
            setTimeout(() => {
                preserveFloatingButtonPosition();
                console.debug('Position preserved after play event');
            }, 10);
        }
    });
    
    // 监听音频暂停事件
    audioElement.addEventListener('pause', () => {
        const button = $('#tts_floating_button');
        if (button.length && audioElement.src && audioElement.src !== '' && !audioElement.src.includes('silence.mp3')) {
            button.removeClass('playing').addClass('paused');
            updateFloatingButtonIcon('pause');
            // 保持位置不变 - 使用延迟确保DOM更新完成
            setTimeout(() => {
                preserveFloatingButtonPosition();
            }, 10);
        }
    });
    
    // 监听音频结束事件，移除播放状态
    audioElement.addEventListener('ended', () => {
        const button = $('#tts_floating_button');
        if (button.length) {
            button.removeClass('playing paused');
            updateFloatingButtonIcon('default');
            audioPaused = false;
            // 保持位置不变 - 使用延迟确保DOM更新完成
            setTimeout(() => {
                preserveFloatingButtonPosition();
            }, 10);
        }
    });
    
    // 重写 resetTtsPlayback，确保状态同步
    const originalResetTtsPlayback = resetTtsPlayback;
    window.resetTtsPlayback = function() {
        const button = $('#tts_floating_button');
        if (button.length) {
            button.removeClass('playing paused long-pressing');
            updateFloatingButtonIcon('default');
            // 保持位置不变 - 使用延迟确保DOM更新完成
            setTimeout(() => {
                preserveFloatingButtonPosition();
            }, 10);
        }
        audioPaused = false;
        originalResetTtsPlayback.call(this);
    };
}


//#############################//
//  Extension UI and Settings  //
//#############################//

function loadSettings() {
    if (Object.keys(extension_settings.SillyTavernTTS).length === 0) {
        Object.assign(extension_settings.SillyTavernTTS, defaultSettings);
    }
    for (const key in defaultSettings) {
        if (!(key in extension_settings.SillyTavernTTS)) {
            extension_settings.SillyTavernTTS[key] = defaultSettings[key];
        }
    }
    $('#tts_provider').val(extension_settings.SillyTavernTTS.currentProvider);
    $('#tts_enabled').prop(
        'checked',
        extension_settings.SillyTavernTTS.enabled,
    );
    $('#tts_auto_generation').prop('checked', extension_settings.SillyTavernTTS.auto_generation);
    $('#tts_periodic_auto_generation').prop('checked', extension_settings.SillyTavernTTS.periodic_auto_generation);
    $('#tts_narrate_user').prop('checked', extension_settings.SillyTavernTTS.narrate_user);
    $('#playback_rate').val(extension_settings.SillyTavernTTS.playback_rate);
    $('#playback_rate_counter').val(Number(extension_settings.SillyTavernTTS.playback_rate).toFixed(2));
    $('#playback_rate_block').toggle(extension_settings.SillyTavernTTS.currentProvider !== 'System');
    $('#tts_extract_from_audio_tag').prop('checked', extension_settings.SillyTavernTTS.extract_from_audio_tag);
    $('#tts_custom_tag').val(extension_settings.SillyTavernTTS.custom_extraction_tag || '');

    $('body').toggleClass('tts', extension_settings.SillyTavernTTS.enabled);
}

const defaultSettings = {
    voiceMap: '',
    ttsEnabled: false,
    currentProvider: 'ElevenLabs',
    auto_generation: true,
    narrate_user: false,
    playback_rate: 1,
    extract_from_audio_tag: true,
    custom_extraction_tag: '',
    narrate_by_paragraphs: false,
};

function setTtsStatus(status, success) {
    $('#tts_status').text(status);
    if (success) {
        $('#tts_status').removeAttr('style');
    } else {
        $('#tts_status').css('color', 'red');
    }
}

function onRefreshClick() {
    Promise.all([
        ttsProvider.onRefreshClick(),
        // updateVoiceMap()
    ]).then(() => {
        extension_settings.SillyTavernTTS[ttsProviderName] = ttsProvider.settings;
        saveSettingsDebounced();
        setTtsStatus('Successfully applied settings', true);
        console.info(`Saved settings ${ttsProviderName} ${JSON.stringify(ttsProvider.settings)}`);
        initVoiceMap();
        updateVoiceMap();
    }).catch(error => {
        toastr.error(error.toString());
        console.error(error);
        setTtsStatus(error, false);
    });
}

function onEnableClick() {
    extension_settings.SillyTavernTTS.enabled = $('#tts_enabled').is(
        ':checked',
    );
    updateUiAudioPlayState();
    saveSettingsDebounced();
    $('body').toggleClass('tts', extension_settings.SillyTavernTTS.enabled);
}


function onAutoGenerationClick() {
    extension_settings.SillyTavernTTS.auto_generation = !!$('#tts_auto_generation').prop('checked');
    saveSettingsDebounced();
}


function onPeriodicAutoGenerationClick() {
    extension_settings.SillyTavernTTS.periodic_auto_generation = !!$('#tts_periodic_auto_generation').prop('checked');
    saveSettingsDebounced();
}


function onNarrateDialoguesClick() {
    extension_settings.SillyTavernTTS.narrate_dialogues_only = !!$('#tts_narrate_dialogues').prop('checked');
    saveSettingsDebounced();
}

function onNarrateUserClick() {
    extension_settings.SillyTavernTTS.narrate_user = !!$('#tts_narrate_user').prop('checked');
    saveSettingsDebounced();
}

function onNarrateQuotedClick() {
    extension_settings.SillyTavernTTS.narrate_quoted_only = !!$('#tts_narrate_quoted').prop('checked');
    saveSettingsDebounced();
}


function onNarrateTranslatedOnlyClick() {
    extension_settings.SillyTavernTTS.narrate_translated_only = !!$('#tts_narrate_translated_only').prop('checked');
    saveSettingsDebounced();
}

function onSkipCodeblocksClick() {
    extension_settings.SillyTavernTTS.skip_codeblocks = !!$('#tts_skip_codeblocks').prop('checked');
    saveSettingsDebounced();
}

function onSkipTagsClick() {
    extension_settings.SillyTavernTTS.skip_tags = !!$('#tts_skip_tags').prop('checked');
    saveSettingsDebounced();
}

function onPassAsterisksClick() {
    extension_settings.SillyTavernTTS.pass_asterisks = !!$('#tts_pass_asterisks').prop('checked');
    saveSettingsDebounced();
    console.log('setting pass asterisks', extension_settings.SillyTavernTTS.pass_asterisks);
}

function onExtractFromAudioTagClick() {
    extension_settings.SillyTavernTTS.extract_from_audio_tag = !!$('#tts_extract_from_audio_tag').prop('checked');
    saveSettingsDebounced();
    console.log('setting extract_from_audio_tag', extension_settings.SillyTavernTTS.extract_from_audio_tag);
}

function onCustomTagInput() {
    extension_settings.SillyTavernTTS.custom_extraction_tag = String($('#tts_custom_tag').val()).trim();
    saveSettingsDebounced();
    console.log('setting custom_extraction_tag', extension_settings.SillyTavernTTS.custom_extraction_tag);
}

//##############//
// TTS Provider //
//##############//

async function loadTtsProvider(provider) {
    //Clear the current config and add new config
    $('#tts_provider_settings').html('');

    if (!provider) {
        return;
    }

    // Init provider references
    extension_settings.SillyTavernTTS.currentProvider = provider;
    ttsProviderName = provider;
    ttsProvider = new ttsProviders[provider];

    // Init provider settings
    $('#tts_provider_settings').append(ttsProvider.settingsHtml);
    if (!(ttsProviderName in extension_settings.SillyTavernTTS)) {
        console.warn(`Provider ${ttsProviderName} not in Extension Settings, initiatilizing provider in settings`);
        extension_settings.SillyTavernTTS[ttsProviderName] = {};
    }
    await ttsProvider.loadSettings(extension_settings.SillyTavernTTS[ttsProviderName]);
    await initVoiceMap();
}

function onTtsProviderChange() {
    const ttsProviderSelection = $('#tts_provider').val();
    extension_settings.SillyTavernTTS.currentProvider = ttsProviderSelection;
    $('#playback_rate_block').toggle(extension_settings.SillyTavernTTS.currentProvider !== 'System');
    loadTtsProvider(ttsProviderSelection);
}

// Ensure that TTS provider settings are saved to extension settings.
export function saveTtsProviderSettings() {
    extension_settings.SillyTavernTTS[ttsProviderName] = ttsProvider.settings;
    updateVoiceMap();
    saveSettingsDebounced();
    console.info(`Saved settings ${ttsProviderName} ${JSON.stringify(ttsProvider.settings)}`);
}


//###################//
// voiceMap Handling //
//###################//

async function onChatChanged() {
    await onGenerationEnded();
    resetTtsPlayback();
    const voiceMapInit = initVoiceMap();
    await Promise.race([voiceMapInit, delay(debounce_timeout.relaxed)]);
    lastMessage = null;
}

async function onMessageEvent(messageId, lastCharIndex) {
    // If TTS is disabled, do nothing
    if (!extension_settings.SillyTavernTTS.enabled) {
        return;
    }

    // Auto generation is disabled
    if (!extension_settings.SillyTavernTTS.auto_generation) {
        return;
    }

    const context = getContext();

    // no characters or group selected
    if (!context.groupId && context.characterId === undefined) {
        return;
    }

    // Chat changed
    if (context.chatId !== lastChatId) {
        lastChatId = context.chatId;
        lastMessageHash = getStringHash(context.chat[messageId]?.mes ?? '');

        // Force to speak on the first message in the new chat
        if (context.chat.length === 1) {
            lastMessageHash = -1;
        }
    }

    // clone message object, as things go haywire if message object is altered below (it's passed by reference)
    const message = structuredClone(context.chat[messageId]);
    const hashNew = getStringHash(message?.mes ?? '');

    // Ignore prompt-hidden messages
    if (message.is_system) {
        return;
    }

    // if no new messages, or same message, or same message hash, do nothing
    if (hashNew === lastMessageHash) {
        return;
    }

    // if we only want to process part of the message
    if (lastCharIndex) {
        message.mes = message.mes.substring(0, lastCharIndex);
    }

    const isLastMessageInCurrent = () =>
        lastMessage &&
        typeof lastMessage === 'object' &&
        message.swipe_id === lastMessage.swipe_id &&
        message.name === lastMessage.name &&
        message.is_user === lastMessage.is_user &&
        message.mes.indexOf(lastMessage.mes) !== -1;

    // if last message within current message, message got extended. only send diff to TTS.
    if (isLastMessageInCurrent()) {
        const tmp = structuredClone(message);
        message.mes = message.mes.replace(lastMessage.mes, '');
        lastMessage = tmp;
    } else {
        lastMessage = structuredClone(message);
    }

    // We're currently swiping. Don't generate voice
    if (!message || message.mes === '...' || message.mes === '') {
        return;
    }

    // Don't generate if message doesn't have a display text
    if (extension_settings.SillyTavernTTS.narrate_translated_only && !(message?.extra?.display_text)) {
        return;
    }

    // Don't generate if message is a user message and user message narration is disabled
    if (message.is_user && !extension_settings.SillyTavernTTS.narrate_user) {
        return;
    }

    // New messages, add new chat to history
    lastMessageHash = hashNew;
    lastChatId = context.chatId;

    console.debug(`Adding message from ${message.name} for TTS processing: "${message.mes}"`);
    processAndQueueTtsMessage(message);
}

async function onMessageDeleted() {
    const context = getContext();

    // update internal references to new last message
    lastChatId = context.chatId;

    // compare against lastMessageHash. If it's the same, we did not delete the last chat item, so no need to reset tts queue
    const messageHash = getStringHash((context.chat.length && context.chat[context.chat.length - 1].mes) ?? '');
    if (messageHash === lastMessageHash) {
        return;
    }
    lastMessageHash = messageHash;
    lastMessage = context.chat.length ? structuredClone(context.chat[context.chat.length - 1]) : null;

    // stop any tts playback since message might not exist anymore
    resetTtsPlayback();
}

async function onGenerationStarted(generationType, _args, isDryRun) {
    // If dry running or quiet mode, do nothing
    if (isDryRun || ['quiet', 'impersonate'].includes(generationType)) {
        return;
    }

    // If TTS is disabled, do nothing
    if (!extension_settings.SillyTavernTTS.enabled) {
        return;
    }

    // Auto generation is disabled
    if (!extension_settings.SillyTavernTTS.auto_generation) {
        return;
    }

    // Periodic auto generation is disabled
    if (!extension_settings.SillyTavernTTS.periodic_auto_generation) {
        return;
    }

    // If the reply is not being streamed
    if (!isStreamingEnabled()) {
        return;
    }

    // start the timer
    if (!periodicMessageGenerationTimer) {
        periodicMessageGenerationTimer = setInterval(onPeriodicMessageGenerationTick, UPDATE_INTERVAL);
    }
}

async function onGenerationEnded() {
    if (periodicMessageGenerationTimer) {
        clearInterval(periodicMessageGenerationTimer);
        periodicMessageGenerationTimer = null;
    }
    lastPositionOfParagraphEnd = -1;
}

async function onPeriodicMessageGenerationTick() {
    const context = getContext();

    // no characters or group selected
    if (!context.groupId && context.characterId === undefined) {
        return;
    }

    const lastMessageId = context.chat.length - 1;

    // the last message was from the user
    if (context.chat[lastMessageId].is_user) {
        return;
    }

    const lastMessage = structuredClone(context.chat[lastMessageId]);
    const lastMessageText = lastMessage?.mes ?? '';

    // look for double ending lines which should indicate the end of a paragraph
    let newLastPositionOfParagraphEnd = lastMessageText
        .indexOf('\n\n', lastPositionOfParagraphEnd + 1);
    // if not found, look for a single ending line which should indicate the end of a paragraph
    if (newLastPositionOfParagraphEnd === -1) {
        newLastPositionOfParagraphEnd = lastMessageText
            .indexOf('\n', lastPositionOfParagraphEnd + 1);
    }

    // send the message to the tts module if we found the new end of a paragraph
    if (newLastPositionOfParagraphEnd > -1) {
        onMessageEvent(lastMessageId, newLastPositionOfParagraphEnd);

        if (periodicMessageGenerationTimer) {
            lastPositionOfParagraphEnd = newLastPositionOfParagraphEnd;
        }
    }
}

/**
 * Get characters in current chat
 * @param {boolean} unrestricted - If true, will include all characters in voiceMapEntries, even if they are not in the current chat.
 * @returns {string[]} - Array of character names
 */
function getCharacters(unrestricted) {
    const context = getContext();

    if (unrestricted) {
        const names = context.characters.map(char => char.name);
        names.unshift(DEFAULT_VOICE_MARKER);
        return names.filter(onlyUnique);
    }

    let characters = [];
    if (context.groupId === null) {
        // Single char chat
        characters.push(DEFAULT_VOICE_MARKER);
        characters.push(context.name1);
        characters.push(context.name2);
    } else {
        // Group chat
        characters.push(DEFAULT_VOICE_MARKER);
        characters.push(context.name1);
        const group = context.groups.find(group => context.groupId == group.id);
        for (let member of group.members) {
            const character = context.characters.find(char => char.avatar == member);
            if (character) {
                characters.push(character.name);
            }
        }
    }
    return characters.filter(onlyUnique);
}

function sanitizeId(input) {
    // Remove any non-alphanumeric characters except underscore (_) and hyphen (-)
    let sanitized = encodeURIComponent(input).replace(/[^a-zA-Z0-9-_]/g, '');

    // Ensure first character is always a letter
    if (!/^[a-zA-Z]/.test(sanitized)) {
        sanitized = 'element_' + sanitized;
    }

    return sanitized;
}

function parseVoiceMap(voiceMapString) {
    let parsedVoiceMap = {};
    for (const [charName, voiceId] of voiceMapString
        .split(',')
        .map(s => s.split(':'))) {
        if (charName && voiceId) {
            parsedVoiceMap[charName.trim()] = voiceId.trim();
        }
    }
    return parsedVoiceMap;
}



/**
 * Apply voiceMap based on current voiceMapEntries
 */
function updateVoiceMap() {
    const tempVoiceMap = {};
    for (const voice of voiceMapEntries) {
        if (voice.voiceId === null) {
            continue;
        }
        tempVoiceMap[voice.name] = voice.voiceId;
    }
    if (Object.keys(tempVoiceMap).length !== 0) {
        voiceMap = tempVoiceMap;
        console.log(`Voicemap updated to ${JSON.stringify(voiceMap)}`);
    }
    if (!extension_settings.SillyTavernTTS[ttsProviderName].voiceMap) {
        extension_settings.SillyTavernTTS[ttsProviderName].voiceMap = {};
    }
    Object.assign(extension_settings.SillyTavernTTS[ttsProviderName].voiceMap, voiceMap);
    saveSettingsDebounced();
}

class VoiceMapEntry {
    name;
    voiceId;
    selectElement;
    constructor(name, voiceId = DEFAULT_VOICE_MARKER) {
        this.name = name;
        this.voiceId = voiceId;
        this.selectElement = null;
    }

    addUI(voiceIds) {
        let sanitizedName = sanitizeId(this.name);
        let defaultOption = this.name === DEFAULT_VOICE_MARKER ?
            `<option>${DISABLED_VOICE_MARKER}</option>` :
            `<option>${DEFAULT_VOICE_MARKER}</option><option>${DISABLED_VOICE_MARKER}</option>`;
        let template = `
            <div class='tts_voicemap_block_char flex-container flexGap5'>
                <span id='tts_voicemap_char_${sanitizedName}'>${this.name}</span>
                <select id='tts_voicemap_char_${sanitizedName}_voice'>
                    ${defaultOption}
                </select>
            </div>
        `;
        $('#tts_voicemap_block').append(template);

        // Populate voice ID select list
        for (const voiceId of voiceIds) {
            const option = document.createElement('option');
            option.innerText = voiceId.name;
            option.value = voiceId.name;
            $(`#tts_voicemap_char_${sanitizedName}_voice`).append(option);
        }

        this.selectElement = $(`#tts_voicemap_char_${sanitizedName}_voice`);
        this.selectElement.on('change', args => this.onSelectChange(args));
        this.selectElement.val(this.voiceId);
    }

    onSelectChange(args) {
        this.voiceId = this.selectElement.find(':selected').val();
        updateVoiceMap();
    }
}

/**
 * Init voiceMapEntries for character select list.
 * If an initialization is already in progress, it returns the existing Promise instead of starting a new one.
 * @param {boolean} unrestricted - If true, will include all characters in voiceMapEntries, even if they are not in the current chat.
 * @returns {Promise} A promise that resolves when the initialization is complete.
 */
export async function initVoiceMap(unrestricted = false) {
    // Preventing parallel execution
    if (currentInitVoiceMapPromise) {
        return currentInitVoiceMapPromise;
    }

    currentInitVoiceMapPromise = (async () => {
        const initialChatId = getCurrentChatId();
        try {
            await initVoiceMapInternal(unrestricted);
        } finally {
            currentInitVoiceMapPromise = null;
        }
        const currentChatId = getCurrentChatId();

        if (initialChatId !== currentChatId) {
            // Chat changed during initialization, reinitialize
            await initVoiceMap(unrestricted);
        }
    })();

    return currentInitVoiceMapPromise;
}

/**
 * Init voiceMapEntries for character select list.
 * @param {boolean} unrestricted - If true, will include all characters in voiceMapEntries, even if they are not in the current chat.
 */
async function initVoiceMapInternal(unrestricted) {
    // Gate initialization if not enabled or TTS Provider not ready. Prevents error popups.
    const enabled = $('#tts_enabled').is(':checked');
    if (!enabled) {
        return;
    }

    // Keep errors inside extension UI rather than toastr. Toastr errors for TTS are annoying.
    try {
        await ttsProvider.checkReady();
    } catch (error) {
        const message = `TTS Provider not ready. ${error}`;
        setTtsStatus(message, false);
        return;
    }

    setTtsStatus('酒馆交流QQ群：2167053013', false);

    // Clear existing voiceMap state
    $('#tts_voicemap_block').empty();
    voiceMapEntries = [];

    // Get characters in current chat
    const characters = getCharacters(unrestricted);

    // Get saved voicemap from provider settings, handling new and old representations
    let voiceMapFromSettings = {};
    if ('voiceMap' in extension_settings.SillyTavernTTS[ttsProviderName]) {
        // Handle previous representation
        if (typeof extension_settings.SillyTavernTTS[ttsProviderName].voiceMap === 'string') {
            voiceMapFromSettings = parseVoiceMap(extension_settings.SillyTavernTTS[ttsProviderName].voiceMap);
            // Handle new representation
        } else if (typeof extension_settings.SillyTavernTTS[ttsProviderName].voiceMap === 'object') {
            voiceMapFromSettings = extension_settings.SillyTavernTTS[ttsProviderName].voiceMap;
        }
    }

    // Get voiceIds from provider
    let voiceIdsFromProvider;
    try {
        voiceIdsFromProvider = await ttsProvider.fetchTtsVoiceObjects();
    }
    catch {
        toastr.error('TTS Provider failed to return voice ids.');
    }

    // Build UI using VoiceMapEntry objects
    for (const character of characters) {
        if (character === 'SillyTavern System') {
            continue;
        }
        // Check provider settings for voiceIds
        let voiceId;
        if (character in voiceMapFromSettings) {
            voiceId = voiceMapFromSettings[character];
        } else if (character === DEFAULT_VOICE_MARKER) {
            voiceId = DISABLED_VOICE_MARKER;
        } else {
            voiceId = DEFAULT_VOICE_MARKER;
        }
        const voiceMapEntry = new VoiceMapEntry(character, voiceId);
        voiceMapEntry.addUI(voiceIdsFromProvider);
        voiceMapEntries.push(voiceMapEntry);
    }
    updateVoiceMap();
}

jQuery(async function () {
    // 初始化 SillyTavernTTS 设置对象
    if (!extension_settings.SillyTavernTTS) {
        extension_settings.SillyTavernTTS = {};
    }
    
    async function addExtensionControls() {
        // 直接使用内嵌HTML，避免模板系统和路径问题
        const settingsHtml = `<div id="tts_settings">
    <div class="inline-drawer">
        <div class="inline-drawer-toggle inline-drawer-header">
            <b>酒馆阅读</b>
            <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
        </div>
        <div class="inline-drawer-content">
            <div id="tts_status">
            </div>
            <span>选择 TTS 提供商</span> </br>
            <div class="tts_block">
                <select id="tts_provider" class="flex1">
                </select>
                <input id="tts_refresh" class="menu_button" type="submit" value="重新加载" />
            </div>
            <div>
                <label class="checkbox_label" for="tts_enabled">
                    <input type="checkbox" id="tts_enabled" name="tts_enabled">
                    <small>已启用</small>
                </label>
                <label class="checkbox_label" for="tts_narrate_user">
                    <input type="checkbox" id="tts_narrate_user">
                    <small>朗读用户消息</small>
                </label>
                <label class="checkbox_label" for="tts_auto_generation">
                    <input type="checkbox" id="tts_auto_generation">
                    <small>自动生成</small>
                </label>
                <label class="checkbox_label" for="tts_periodic_auto_generation" title="需要启用自动生成功能">
                    <input type="checkbox" id="tts_periodic_auto_generation">
                    <small>按段朗读（流式播放时）</small>
                </label>
                <label class="checkbox_label" for="tts_extract_from_audio_tag">
                    <input type="checkbox" id="tts_extract_from_audio_tag" checked>
                    <small>从 &lt;audio&gt; 标签提取文本</small>
                </label>
                <label for="tts_custom_tag">
                    <small>自定义提取标签（可选，优先级更高）：</small>
                </label>
                <input type="text" id="tts_custom_tag" class="text_pole" placeholder="例如：content, thinking 或 content,thinking,audio" maxlength="100" />
                <small>支持多个标签，用逗号分隔。如果设置了自定义标签，系统会优先从这些标签中提取文本。留空则默认从 &lt;audio&gt; 标签提取。</small>
            </div>
            <div id="playback_rate_block" class="range-block">
                <hr>
                <div class="range-block-title justifyLeft">
                    <small>音频播放速度</small>
                </div>
                <div class="range-block-range-and-counter">
                    <div class="range-block-range">
                        <input type="range" id="playback_rate" name="volume" min="0" max="3" step="0.05">
                    </div>
                    <div class="range-block-counter">
                        <input type="number" min="0" max="3" step="0.05" data-for="playback_rate" id="playback_rate_counter">
                    </div>
                </div>
            </div>
            <div id="tts_voicemap_block">
            </div>
            <hr>
            <form id="tts_provider_settings">
            </form>
            <div class="tts_buttons">
                <input id="tts_voices" class="menu_button" type="submit" value="可用语音列表" />
            </div>
            </div>
        </div>
    </div>
</div>`;
        $('#tts_container').append($(settingsHtml));
        $('#tts_refresh').on('click', onRefreshClick);
        $('#tts_enabled').on('click', onEnableClick);
        $('#tts_auto_generation').on('click', onAutoGenerationClick);
        $('#tts_periodic_auto_generation').on('click', onPeriodicAutoGenerationClick);
        $('#tts_narrate_user').on('click', onNarrateUserClick);
        $('#tts_extract_from_audio_tag').on('click', onExtractFromAudioTagClick);
        $('#tts_custom_tag').on('input', onCustomTagInput);

        $('#playback_rate').on('input', function () {
            const value = $(this).val();
            const formattedValue = Number(value).toFixed(2);
            extension_settings.SillyTavernTTS.playback_rate = value;
            $('#playback_rate_counter').val(formattedValue);
            saveSettingsDebounced();
        });

        $('#tts_voices').on('click', onTtsVoicesClick);
        for (const provider in ttsProviders) {
            $('#tts_provider').append($('<option />').val(provider).text(provider));
        }
        $('#tts_provider').on('change', onTtsProviderChange);
        $(document).on('click', '.mes_narrate', onNarrateOneMessage);
    }
    await addExtensionControls(); // No init dependencies
    loadSettings(); // Depends on Extension Controls and loadTtsProvider
    loadTtsProvider(extension_settings.SillyTavernTTS.currentProvider); // No dependencies
    addAudioControl(); // Depends on Extension Controls
    const wrapper = new ModuleWorkerWrapper(moduleWorker);
    setInterval(wrapper.update.bind(wrapper), UPDATE_INTERVAL); // Init depends on all the things
    eventSource.on(event_types.MESSAGE_SWIPED, resetTtsPlayback);
    eventSource.on(event_types.CHAT_CHANGED, onChatChanged);
    eventSource.on(event_types.MESSAGE_DELETED, onMessageDeleted);
    eventSource.on(event_types.GROUP_UPDATED, onChatChanged);
    eventSource.on(event_types.GENERATION_STARTED, onGenerationStarted);
    eventSource.on(event_types.GENERATION_ENDED, onGenerationEnded);
    // 新版酒馆需要用箭头函数包装，以正确传递messageId参数
    eventSource.makeLast(event_types.CHARACTER_MESSAGE_RENDERED, (messageId) => onMessageEvent(messageId));
    eventSource.makeLast(event_types.USER_MESSAGE_RENDERED, (messageId) => onMessageEvent(messageId));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'speak',
        callback: async (args, value) => {
            await onNarrateText(args, value);
            return '';
        },
        aliases: ['narrate', 'tts'],
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'voice',
                description: 'character voice name',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: false,
                enumProvider: () => Object.keys(voiceMap).map(voiceName => new SlashCommandEnumValue(voiceName, null, enumTypes.enum, enumIcons.voice)),
            }),
        ],
        unnamedArgumentList: [
            new SlashCommandArgument(
                'text', [ARGUMENT_TYPE.STRING], true,
            ),
        ],
        helpString: `
            <div>
                Narrate any text using currently selected character's voice.
            </div>
            <div>
                Use <code>voice="Character Name"</code> argument to set other voice from the voice map.
            </div>
            <div>
                <strong>Example:</strong>
                <ul>
                    <li>
                        <pre><code>/speak voice="Donald Duck" Quack!</code></pre>
                    </li>
                </ul>
            </div>
        `,
    }));

    document.body.appendChild(audioElement);
});
