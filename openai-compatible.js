import { getRequestHeaders, eventSource, event_types } from '/script.js';
import { callGenericPopup, POPUP_RESULT, POPUP_TYPE } from '/scripts/popup.js';
import { findSecret, SECRET_KEYS, secret_state, writeSecret } from '/scripts/secrets.js';
import { getPreviewString, saveTtsProviderSettings } from './index.js';

export { OpenAICompatibleTtsProvider };

class OpenAICompatibleTtsProvider {
    settings;
    voices = [];
    separator = ' . ';
    handler = null; // 用于存储事件处理器（高版本）

    audioElement = document.createElement('audio');

    defaultSettings = {
        voiceMap: {},
        model: 'tts-1',
        speed: 1,
        available_voices: ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'],
        provider_endpoint: 'http://127.0.0.1:8000/v1/audio/speech',
    };

    // 构造函数（高版本需要）
    constructor() {
        // 更精确的版本检测：检查是否真正支持manage-api-keys系统
        if (this.isHighVersionWithApiKeyManagement()) {
            this.handler = async function (/** @type {string} */ key) {
                if (key !== SECRET_KEYS.CUSTOM_OPENAI_TTS) return;
                $('#openai_compatible_tts_key').toggleClass('success', !!secret_state[SECRET_KEYS.CUSTOM_OPENAI_TTS]);
                await this.onRefreshClick();
            }.bind(this);
        }
    }
    
    /**
     * 检测是否为支持新版API密钥管理的高版本酒馆
     */
    isHighVersionWithApiKeyManagement() {
        // 检查必要的全局变量
        if (typeof eventSource === 'undefined' || !eventSource || 
            typeof event_types === 'undefined' || !event_types) {
            return false;
        }
        
        // 检查是否有manage-api-keys相关的CSS类或处理函数
        // 新版酒馆会有专门的API密钥管理CSS和JavaScript
        const hasApiKeyManagementCSS = $('style, link[rel="stylesheet"]').toArray().some(styleEl => {
            const content = styleEl.textContent || '';
            return content.includes('manage-api-keys') || content.includes('.manage-api-keys');
        });
        
        // 检查是否有API密钥管理的JavaScript函数
        const hasApiKeyManagementJS = typeof window.manageApiKeys === 'function' ||
                                     typeof window.setupApiKeyManagement === 'function' ||
                                     $('[data-key]').length > 0; // 检查是否已有其他使用data-key的元素
        
        // 检查是否有相关的事件类型
        const hasSecretEvents = event_types.SECRET_WRITTEN && 
                               event_types.SECRET_DELETED && 
                               event_types.SECRET_ROTATED;
        
        console.debug('API Key Management Detection:', {
            hasEventSource: !!eventSource,
            hasEventTypes: !!event_types,
            hasApiKeyManagementCSS,
            hasApiKeyManagementJS,
            hasSecretEvents,
            dataKeyElements: $('[data-key]').length
        });
        
        // 只有当所有条件都满足时才认为是高版本
        return hasSecretEvents && (hasApiKeyManagementCSS || hasApiKeyManagementJS);
    }

    // 析构函数（高版本需要）
    dispose() {
        if (this.handler && this.isHighVersionWithApiKeyManagement()) {
            [event_types.SECRET_WRITTEN, event_types.SECRET_DELETED, event_types.SECRET_ROTATED].forEach(event => {
                try {
                    eventSource.removeListener(event, this.handler);
                } catch (e) {
                    console.debug('Failed to remove event listener:', e);
                }
            });
        }
    }

    get settingsHtml() {
        // 根据版本检测结果生成不同的HTML
        const isHighVersion = this.isHighVersionWithApiKeyManagement();
        
        // 高版本使用 manage-api-keys 类和 data-key 属性
        const apiKeyButton = isHighVersion 
            ? `<div id="openai_compatible_tts_key" class="menu_button menu_button_icon manage-api-keys" data-key="api_key_custom_openai_tts">
                <i class="fa-solid fa-key"></i>
                <span>API Key</span>
            </div>`
            : `<div id="openai_compatible_tts_key" class="menu_button menu_button_icon">
                <i class="fa-solid fa-key"></i>
                <span>API Key</span>
            </div>`;
        
        let html = `
        <label for="openai_compatible_tts_endpoint">Provider Endpoint:</label>
        <div class="flex-container alignItemsCenter">
            <div class="flex1">
                <input id="openai_compatible_tts_endpoint" type="text" class="text_pole" maxlength="500" value="${this.defaultSettings.provider_endpoint}"/>
            </div>
            ${apiKeyButton}
        </div>
        <label for="openai_compatible_model">Model:</label>
        <input id="openai_compatible_model" type="text" class="text_pole" maxlength="500" value="${this.defaultSettings.model}"/>
        <label for="openai_compatible_tts_voices">Available Voices (comma separated):</label>
        <input id="openai_compatible_tts_voices" type="text" class="text_pole" maxlength="500" value="${this.defaultSettings.available_voices.join()}"/>
        <label for="openai_compatible_tts_speed">Speed: <span id="openai_compatible_tts_speed_output"></span></label>
        <input type="range" id="openai_compatible_tts_speed" value="${this.defaultSettings.speed}" min="0.25" max="4" step="0.05">`;
        
        console.debug('OpenAI Compatible: Generated HTML for', isHighVersion ? 'high' : 'low', 'version');
        return html;
    }

    async loadSettings(settings) {
        // Populate Provider UI given input settings
        if (Object.keys(settings).length == 0) {
            console.info('Using default TTS Provider settings');
        }

        // Only accept keys defined in defaultSettings
        this.settings = this.defaultSettings;

        for (const key in settings) {
            if (key in this.settings) {
                this.settings[key] = settings[key];
            } else {
                throw `Invalid setting passed to TTS Provider: ${key}`;
            }
        }

        $('#openai_compatible_tts_endpoint').val(this.settings.provider_endpoint);
        $('#openai_compatible_tts_endpoint').on('input', () => { this.onSettingsChange(); });

        $('#openai_compatible_model').val(this.settings.model);
        $('#openai_compatible_model').on('input', () => { this.onSettingsChange(); });

        $('#openai_compatible_tts_voices').val(this.settings.available_voices.join());
        $('#openai_compatible_tts_voices').on('input', () => { this.onSettingsChange(); });

        $('#openai_compatible_tts_speed').val(this.settings.speed);
        $('#openai_compatible_tts_speed').on('input', () => {
            this.onSettingsChange();
        });

        $('#openai_compatible_tts_speed_output').text(this.settings.speed);

        // 设置API Key按钮状态
        $('#openai_compatible_tts_key').toggleClass('success', !!secret_state[SECRET_KEYS.CUSTOM_OPENAI_TTS]);
        
        // 延迟检测，确保DOM和全局变量都已准备好
        setTimeout(() => {
            const isHighVersion = this.isHighVersionWithApiKeyManagement();
            console.debug('OpenAI Compatible: Detected version -', isHighVersion ? 'High' : 'Low');
            
            if (isHighVersion && this.handler) {
                // 高版本：注册事件监听器
                try {
                    [event_types.SECRET_WRITTEN, event_types.SECRET_DELETED, event_types.SECRET_ROTATED].forEach(event => {
                        eventSource.on(event, this.handler);
                    });
                    console.debug('OpenAI Compatible: Registered high-version event handlers');
                } catch (e) {
                    console.warn('OpenAI Compatible: Failed to register event listener:', e);
                    // 如果注册失败，降级到低版本处理
                    this.setupLowVersionHandler();
                }
            } else {
                // 低版本：手动绑定点击事件
                this.setupLowVersionHandler();
            }
        }, 200); // 增加延迟时间，确保所有系统都已加载

        await this.checkReady();

        console.debug('OpenAI Compatible TTS: Settings loaded');
    }
    
    /**
     * 设置低版本的点击处理器
     */
    setupLowVersionHandler() {
        const $keyButton = $('#openai_compatible_tts_key');
        
        console.debug('OpenAI Compatible: Setting up low-version click handler');
        $keyButton.off('click').on('click', async () => {
            const popupText = 'OpenAI-compatible TTS API Key';
            const savedKey = secret_state[SECRET_KEYS.CUSTOM_OPENAI_TTS] ? await findSecret(SECRET_KEYS.CUSTOM_OPENAI_TTS) : '';

            const key = await callGenericPopup(popupText, POPUP_TYPE.INPUT, savedKey, {
                customButtons: [{
                    text: 'Remove Key',
                    appendAtEnd: true,
                    result: POPUP_RESULT.NEGATIVE,
                    action: async () => {
                        await writeSecret(SECRET_KEYS.CUSTOM_OPENAI_TTS, '');
                        $('#openai_compatible_tts_key').toggleClass('success', !!secret_state[SECRET_KEYS.CUSTOM_OPENAI_TTS]);
                        toastr.success('API Key removed');
                        await this.onRefreshClick();
                    },
                }],
            });

            if (!key) {
                return;
            }

            await writeSecret(SECRET_KEYS.CUSTOM_OPENAI_TTS, String(key));

            toastr.success('API Key saved');
            $('#openai_compatible_tts_key').toggleClass('success', secret_state[SECRET_KEYS.CUSTOM_OPENAI_TTS]);
            await this.onRefreshClick();
        });
    }

    onSettingsChange() {
        // Update dynamically
        this.settings.provider_endpoint = String($('#openai_compatible_tts_endpoint').val());
        this.settings.model = String($('#openai_compatible_model').val());
        this.settings.available_voices = String($('#openai_compatible_tts_voices').val()).split(',');
        this.settings.speed = Number($('#openai_compatible_tts_speed').val());
        $('#openai_compatible_tts_speed_output').text(this.settings.speed);
        saveTtsProviderSettings();
    }

    async checkReady() {
        this.voices = await this.fetchTtsVoiceObjects();
    }

    async onRefreshClick() {
        return;
    }

    async getVoice(voiceName) {
        if (this.voices.length == 0) {
            this.voices = await this.fetchTtsVoiceObjects();
        }
        const match = this.voices.filter(
            oaicVoice => oaicVoice.name == voiceName,
        )[0];
        if (!match) {
            throw `TTS Voice name ${voiceName} not found`;
        }
        return match;
    }

    async generateTts(text, voiceId) {
        const response = await this.fetchTtsGeneration(text, voiceId);
        return response;
    }

    async fetchTtsVoiceObjects() {
        return this.settings.available_voices.map(v => {
            return { name: v, voice_id: v, lang: 'en-US' };
        });
    }

    async previewTtsVoice(voiceId) {
        this.audioElement.pause();
        this.audioElement.currentTime = 0;

        const text = getPreviewString('en-US');
        const response = await this.fetchTtsGeneration(text, voiceId);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const audio = await response.blob();
        const url = URL.createObjectURL(audio);
        this.audioElement.src = url;
        this.audioElement.play();
        this.audioElement.onended = () => URL.revokeObjectURL(url);
    }

    /**
     * 从页面 DOM 中提取最新消息的文本内容
     * 会自动去除所有 HTML 标签（如 <p>, <br> 等）
     * @returns {string} 清理后的纯文本内容
     */
    extractTextFromMesBlock() {
        // 获取所有消息块
        const mesBlocks = document.querySelectorAll('.mes_block');
        if (mesBlocks.length === 0) {
            console.warn('No message blocks found on page');
            return '';
        }
        
        // 获取最后一个消息块
        const lastMesBlock = mesBlocks[mesBlocks.length - 1];
        
        // 查找其中的 mes_text 元素
        const mesTextElement = lastMesBlock.querySelector('.mes_text');
        if (!mesTextElement) {
            console.warn('No mes_text element found in message block');
            return '';
        }
        
        // 使用 textContent 自动去除所有 HTML 标签
        // 这会移除 <p>, <br>, 以及其他所有 HTML 标签
        const cleanText = mesTextElement.textContent.trim();
        
        console.debug('Extracted text from mes_text:', cleanText);
        return cleanText;
    }

    async fetchTtsGeneration(inputText, voiceId) {
        console.info(`Generating new TTS for voice_id ${voiceId}`);
        
        // 从 DOM 中提取 mes_text 的文本内容
        const mesText = this.extractTextFromMesBlock();
        
        // 如果成功提取到文本，使用它；否则回退到传入的 inputText
        const finalText = mesText || inputText;
        
        console.debug(`Using text for TTS: "${finalText}"`);
        
        const response = await fetch('/api/openai/custom/generate-voice', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({
                provider_endpoint: this.settings.provider_endpoint,
                model: this.settings.model,
                input: finalText,
                voice: voiceId,
                response_format: 'mp3',
                speed: this.settings.speed,
            }),
        });

        if (!response.ok) {
            toastr.error(response.statusText, 'TTS Generation Failed');
            throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        }

        return response;
    }
}
