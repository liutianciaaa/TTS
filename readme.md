# SillyTavern TTS 扩展插件

这是一个为 SillyTavern（酒馆）开发的文本转语音（TTS）扩展插件，支持多种 TTS 提供商。

## 主要功能

> 💡 **查看详细使用示例**：请参阅 [USAGE_EXAMPLES.md](USAGE_EXAMPLES.md) 获取完整的配置示例和使用场景。

### 1. 多 TTS 提供商支持
- 支持 OpenAI、ElevenLabs、Azure、Coqui、Edge TTS 等多个 TTS 服务商
- 可自定义 TTS 服务端点
- 灵活配置语音参数

### 2. 正则文本处理系统 ⭐⭐重磅新功能
- **完全兼容SillyTavern正则系统**：支持导入酒馆导出的正则脚本文件
- **强大的文本处理能力**：
  - 使用正则表达式精确提取和处理TTS朗读文本
  - 支持捕获组 ($1, $2, $<name> 等)
  - 支持字符串清理和替换
  - 支持多个正则脚本顺序执行
- **灵活的脚本管理**：
  - 导入/导出正则脚本JSON文件
  - 可视化编辑正则脚本
  - 实时测试正则效果
  - 单独启用/禁用每个脚本
- **处理优先级**：正则脚本 → 标签提取 → TTS朗读
- **使用场景示例**：
  - 从复杂格式的消息中提取对话内容
  - 移除特定的标记或格式
  - 替换或转换文本内容
  - 与SillyTavern的正则系统完美协同

### 3. 智能文本读取
- **DOM 文本读取**：自动从页面消息框（`div.mes_text`）中读取文本内容
- **自定义标签提取**：支持从特定HTML标签中提取文本内容
  - 可从 `<audio>` 标签中提取内容（默认开启）
  - 支持自定义标签名称（如 `<content>`、`<thinking>` 等）
  - 优先级：正则脚本 > 自定义标签 > audio标签 > 全文本
- **HTML 标签过滤**：智能去除 `<p>`、`<div>` 等 HTML 标签，只保留纯文本
- **多消息支持**：能识别页面上所有消息，并优先处理最新消息

### 4. 悬浮朗读按钮 ⭐重大升级
- **可拖动悬浮图标**：屏幕右下角显示一个精美的悬浮按钮（45px设计）
- **智能播放/暂停控制** ⭐最新：
  - 没有播放时点击：播放最后一条消息
  - 正在播放时点击：暂停播放（按钮变黄色）
  - 暂停时点击：继续播放
  - 图标随状态智能切换（🔊播放 / ⏸暂停）
- **长按停止功能** ⭐最新：
  - 长按按钮5秒，外圈显示红色进度条
  - 倒计时结束后彻底停止播放
  - 拖动时自动取消长按
- **自由移动**：可以拖动到屏幕任意位置，不遮挡阅读
- **精美状态反馈**：
  - 🔵 蓝色：待机状态
  - 🟢 绿色脉动：正在播放
  - 🟡 黄色：暂停状态
  - 🔴 红色进度条：长按停止倒计时
- **超流畅拖动**：使用原生DOM操作和transform，实现60fps流畅拖动体验

### 5. 单个消息播放功能 ⭐修复
- **精确播放**：点击每个消息旁边的播放按钮，播放对应消息内容
- **智能文本处理**：修复了OpenAI Compatible提供商总是播放最新消息的问题
- **兼容性保证**：确保所有TTS提供商都能正确处理单个消息播放

### 6. 自动朗读功能
- 新消息自动朗读
- 支持按段落朗读（流式生成时）
- 可选择只朗读引号内容
- 可过滤星号、代码块等内容

### 7. 语音映射管理
- 为不同角色分配不同语音
- 支持群聊中多角色语音配置
- 提供默认语音和禁用选项

## 使用方法

### 正则文本处理系统使用 ⭐⭐全新功能

#### 快速开始
1. **导入正则脚本**：
   - 在 TTS 扩展设置中找到"正则文本处理"部分
   - 点击"导入正则脚本"按钮
   - 选择从 SillyTavern 导出的正则脚本 JSON 文件
   - 脚本会自动加载到列表中

2. **创建新脚本**：
   - 点击"新建正则脚本"按钮
   - 填写脚本信息：
     - **脚本名称**：给脚本起个有意义的名字
     - **查找正则**：输入正则表达式（支持 `/pattern/flags` 格式）
     - **替换字符串**：输入替换内容（支持 `$1`, `$2`, `$<name>` 等捕获组）
     - **移除字符**：可选，从捕获结果中移除指定字符
   - 使用实时测试功能验证正则效果
   - 点击"保存"

3. **启用正则处理**：
   - 勾选"启用正则文本处理"开关
   - 确保要使用的脚本已启用（列表中勾选"启用"）
   - 正则脚本会自动应用到所有 TTS 朗读文本

#### 正则脚本示例

**示例1：提取 audio 标签内容**
```
脚本名称: 提取audio标签
查找正则: /<audio>(.*?)<\/audio>/gi
替换字符串: $1
说明: 提取所有 <audio> 标签内的文本内容
```

**示例2：移除思考标签**
```
脚本名称: 移除thinking标签
查找正则: /<thinking>.*?<\/thinking>/gis
替换字符串: (留空)
说明: 删除所有 <thinking> 标签及其内容
```

**示例3：提取对话内容**
```
脚本名称: 提取引号对话
查找正则: /"([^"]+)"/g
替换字符串: $1 
说明: 提取所有双引号中的对话内容
```

**示例4：替换特殊标记**
```
脚本名称: 替换动作标记
查找正则: /\*([^*]+)\*/g
替换字符串: (动作: $1)
说明: 将 *动作* 格式转换为 (动作: 内容)
```

#### 高级功能

**脚本管理**：
- **启用/禁用**：单击列表中的"启用"开关
- **编辑脚本**：点击编辑按钮修改脚本
- **删除脚本**：点击删除按钮移除脚本
- **导出脚本**：将所有脚本导出为 JSON 文件
- **测试功能**：点击"测试正则"进行独立测试

**脚本执行顺序**：
- 脚本按列表顺序从上到下依次执行
- 前一个脚本的输出作为下一个脚本的输入
- 可以拖动调整脚本执行顺序

**与标签提取的配合**：
- 正则脚本 → 自定义标签 → audio标签 → 全文本
- 正则脚本会先处理原始消息文本
- 然后标签提取系统再处理正则结果
- 两个系统可以完美配合使用

#### 兼容性说明

- ✅ **完全兼容** SillyTavern 正则系统导出的 JSON 文件
- ✅ 支持所有标准正则表达式语法
- ✅ 支持捕获组、命名捕获组、修饰符等高级特性
- ✅ 可以在 SillyTavern 中设计和测试正则，然后导入到 TTS 插件使用

### 悬浮朗读按钮使用 ⭐全新升级
1. **启用 TTS**：在扩展设置中勾选"Enabled"启用 TTS 功能
2. **选择提供商**：从下拉列表中选择你的 TTS 服务提供商
3. **配置语音**：为角色配置对应的语音
4. **智能播放控制** ⭐最新：
   - **首次点击**：播放最后一条消息（按钮变绿色并脉动）
   - **播放时点击**：暂停播放（按钮变黄色）
   - **暂停时点击**：继续播放（按钮恢复绿色）
   - 图标自动切换：🔊（待机）→ ▶️（播放）→ ⏸（暂停）
5. **长按停止** ⭐最新：
   - 长按按钮超过0.5秒，外圈出现红色进度条
   - 保持5秒后自动停止播放并清空队列
   - 松开鼠标或拖动可取消长按
6. **移动按钮**：
   - 按住并拖动悬浮按钮可移动到任意位置
   - 松开鼠标后按钮会固定在新位置
   - 拖动时自动取消长按计时器

### 单个消息播放使用
1. **找到播放按钮**：每条消息旁边都有一个播放按钮
2. **点击播放**：点击对应消息的播放按钮
3. **精确播放**：系统会播放该条消息的具体内容，而不是最新消息

### 自定义标签提取使用 ⭐新功能
1. **使用audio标签（默认）**：
   - 在你的角色卡或消息模板中使用 `<audio>` 标签包裹需要朗读的内容
   - 例如：`<audio>这是需要朗读的文本</audio>`
   - 系统会自动从audio标签中提取文本进行朗读
   
2. **使用自定义标签**：
   - 在"Text Extraction Settings"中设置自定义标签名称
   - 例如：设置为 `content`，然后在消息中使用 `<content>需要朗读的内容</content>`
   - 自定义标签的优先级高于audio标签
   
3. **使用示例**：
   ```html
   <!-- 使用audio标签 -->
   <audio>
   这段文本会被朗读出来
   </audio>
   
   <!-- 使用自定义标签（设置custom_tag为thinking） -->
   <thinking>
   这是角色的内心想法，也会被朗读
   </thinking>
   ```

4. **关闭audio标签提取**：
   - 如果不想从audio标签提取，取消勾选"Extract text from audio tag"
   - 但此时必须设置自定义标签，否则会回退到全文本提取模式

### OpenAI Compatible 提供商特殊功能
- **智能文本提取**：使用 OpenAI Compatible 提供商时，会自动从页面消息框读取文本
- **去除格式标签**：自动清理 HTML 标签，确保朗读内容纯净
- **备用机制**：如果页面没有消息内容，会使用传统的文本输入方式
- **修复问题**：已修复单个消息播放时总是播放最新消息的问题

### 配置选项说明
- **Provider Endpoint**：TTS 服务的 API 地址
- **Model**：使用的 TTS 模型（如 `tts-1`）
- **Available Voices**：可用的语音列表（逗号分隔）
- **Speed**：朗读速度（0.25-4.0）
- **API Key**：服务商的 API 密钥

### 文本提取设置 ⭐新功能
- **Extract text from &lt;audio&gt; tag**：从 `<audio>` 标签中提取文本内容（默认开启）
- **Custom extraction tag**：自定义标签名称（可选，优先级更高）
  - 例如：设置为 `content`，将从 `<content>` 标签中提取文本
  - 例如：设置为 `thinking`，将从 `<thinking>` 标签中提取文本
  - 留空则使用默认的 `<audio>` 标签
  - 自定义标签的优先级高于audio标签

## 高级功能

### 文本处理选项
- **Narrate user messages**：朗读用户消息
- **Auto Generation**：新消息自动朗读
- **Narrate by paragraphs**：按段落朗读（流式生成时）
- **Only narrate quotes**：仅朗读引号内的文字
- **Ignore text inside asterisks**：忽略星号内的文本
- **Skip codeblocks**：跳过代码块
- **Skip tagged blocks**：跳过标签块
- **Audio Playback Speed**：音频播放速度调整

### 快捷功能
- **TTS Playback**：播放/暂停 TTS
- **Narrate All Chat**：朗读当前聊天的所有消息
- **Available voices**：查看所有可用语音并试听

## 命令支持

可以使用斜杠命令 `/speak` 或 `/narrate` 朗读指定文本：

```
/speak 你好，世界！
/speak voice="角色名" 使用指定角色的语音朗读
```

## 技术特性

### 版本兼容性 ⭐新特性
- **自动版本检测**：运行时检测酒馆版本特征
- **高版本支持**：
  - 使用`manage-api-keys`类和`data-key`属性
  - 通过eventSource监听API Key变化
  - 实现constructor和dispose生命周期
- **低版本支持**：
  - 手动实现API Key弹窗管理
  - 传统的onClick事件处理
  - 向后兼容旧版API
- **智能降级**：根据可用功能自动选择最佳实现方式

### DOM 文本提取
- 使用 `document.querySelectorAll('.mes_text')` 获取所有消息
- 自动提取最后一条消息内容
- **智能标签提取** ⭐新功能：
  - 优先从自定义标签中提取文本（如果设置）
  - 其次从 `<audio>` 标签中提取文本（如果启用）
  - 最后使用默认的全文本提取方式
- 智能清理 HTML 标签和多余空白字符

### 悬浮按钮技术
- 使用 CSS3 渐变和动画效果
- 完整的拖拽功能实现
- 边界检测，防止按钮拖出屏幕
- 区分点击和拖拽事件，防止误触
- 使用原生DOM操作和transform属性，实现60fps流畅拖动

### 播放状态管理
- 实时监听音频播放状态
- 播放时显示动画效果
- 自动清理播放状态

### 单个消息播放修复
- 修复了OpenAI Compatible提供商的文本覆盖问题
- 确保每个消息的播放按钮播放对应的消息内容
- 保持悬浮按钮播放最新消息的功能不变

## 故障排除

1. **升级后设置丢失** ⭐重要
   - 本次更新修改了设置保存位置（避免与酒馆自带TTS冲突）
   - 需要重新配置一次TTS提供商和语音映射
   - 未来更新将保留设置

2. **悬浮按钮不显示**
   - 检查 TTS 是否已启用
   - 刷新页面重新加载插件

3. **点击按钮没有反应**
   - 确认页面上有消息内容
   - 检查控制台是否有错误信息
   - 确认已配置语音映射

4. **播放/暂停功能异常** ⭐新功能相关
   - 确保使用最新版本的代码
   - 检查浏览器控制台是否有JavaScript错误
   - 尝试刷新页面重新加载插件
   - 播放状态应该实时同步（绿色=播放，黄色=暂停）

5. **长按停止不工作** ⭐新功能相关
   - 需要按住超过0.5秒才会开始倒计时
   - 拖动或松开鼠标会取消长按
   - 确保按钮没有被其他元素遮挡

6. **朗读内容不正确**
   - 检查消息框 HTML 结构是否正确
   - 查看控制台日志确认提取的文本

7. **单个消息播放问题**
   - 已修复OpenAI Compatible提供商的问题
   - 如果仍有问题，请检查使用的TTS提供商
   - 查看控制台日志确认文本处理过程

8. **拖动按钮卡顿**
   - 已全面优化拖动性能，使用原生DOM操作和transform属性
   - 移除了节流延迟，实现真正的60fps流畅拖动体验
   - 如仍有问题，尝试关闭其他占用资源的扩展

9. **自定义标签提取问题**
   - 确保标签名称拼写正确（不需要尖括号）
   - 检查消息中是否确实包含该标签
   - 查看浏览器控制台日志确认提取过程
   - 如果标签不存在，系统会自动回退到默认提取方式
   
10. **文本提取不正确**
   - 检查"Extract text from audio tag"开关状态
   - 确认自定义标签设置是否正确
   - 清空自定义标签输入框可恢复到默认audio标签提取
   - 查看控制台日志了解实际提取的内容

11. **OpenAI-compatible设置不显示** ⭐已完全修复
   - 本次更新已完全修复该问题，支持高低版本酒馆
   - 插件会自动检测酒馆版本并使用对应的API管理方式
   - 如果仍不显示，请清除浏览器缓存后重试
   - 查看控制台确认版本检测是否正确

12. **移动端拖拽问题** ⭐已完全修复
   - 修复了移动端无法拖拽悬浮按钮的问题
   - 如果仍无法拖拽，请确保浏览器支持触摸事件
   - 尝试刷新页面重新加载插件
   - 检查是否有其他插件干扰触摸事件

13. **移动端位置跳转问题** ⭐已完全修复
   - 修复了点击后按钮跳转到左上角的问题
   - 移动端默认位置为左侧垂直居中
   - 拖拽后的自定义位置会被正确保存
   - 如果位置仍有问题，尝试清除浏览器缓存

## 更新日志

### 最新版本 (2025-12-01) ⭐⭐重磅更新 - 正则系统集成
- ✅ **正则文本处理系统** ⭐⭐全新功能：
  - 完全集成 SillyTavern 的正则系统
  - 支持导入/导出 SillyTavern 正则脚本 JSON 文件
  - 可视化正则脚本编辑器，支持实时测试
  - 多脚本顺序执行，灵活处理复杂文本格式
  - 支持捕获组、命名捕获组等高级正则特性
  - 独立的启用/禁用控制，不影响其他功能
- ✅ **文本处理流程优化**：
  - 新的处理优先级：正则脚本 → 标签提取 → TTS朗读
  - 正则脚本先处理原始消息文本
  - 标签提取再处理正则输出结果
  - 两个系统可完美配合使用
- ✅ **用户体验改进**：
  - 直观的脚本管理界面
  - 详细的使用说明和示例
  - 完善的错误处理和提示
  - 支持脚本导入导出，方便分享和备份
- 📚 **文档更新**：
  - 新增正则系统详细使用教程
  - 提供多个实用的正则脚本示例
  - 更新功能说明和使用方法

### 历史版本 (2025-11-09) ⭐重要修复更新
- ✅ **单个消息播放按钮修复** ⭐重要修复：
  - 修复了点击单个消息旁边的播放按钮总是播放最新消息的问题
  - 现在点击每个消息的播放按钮会正确播放对应楼层的消息内容
  - 优化了OpenAI Compatible提供商的文本处理逻辑，优先使用传入的文本而不是DOM提取
  - 保持悬浮按钮播放最新消息的功能不变
- ✅ **移动端拖拽功能修复** ⭐重要修复：
  - 修复了移动端无法拖拽悬浮按钮的问题
  - 增强触摸事件处理，支持单点触摸拖拽
  - 添加触摸取消事件处理，提高稳定性
  - 强化CSS触摸行为控制（touch-action: none）
- ✅ **移动端位置跳转修复** ⭐重要修复：
  - 修复了移动端点击后按钮跳转到左上角的问题
  - 统一移动端检测逻辑，确保JS和CSS同步
  - 优化位置保持机制，使用延迟确保DOM更新完成
  - 改进媒体查询，防止自定义位置被覆盖
- ✅ **移动端用户体验优化**：
  - 禁用iOS长按菜单和点击高亮
  - 优化拖拽时的视觉反馈
  - 改进移动端的触摸响应性能

### 历史版本 (2025-11-06) ⭐重大更新
- ✅ **悬浮按钮全面升级**：智能播放/暂停控制
  - 点击切换播放/暂停状态，不再每次都播放新消息
  - 播放状态可视化：绿色脉动（播放）、黄色（暂停）、蓝色（待机）
  - 图标智能切换：🔊 → ▶️ → ⏸，清晰展示当前状态
- ✅ **长按停止功能** ⭐新功能：
  - 长按5秒显示红色圆形进度条
  - 倒计时结束彻底停止播放
  - 支持拖动时自动取消
- ✅ **完美兼容高低版本酒馆** ⭐重要更新：
  - 自动检测酒馆版本并使用对应的API管理方式
  - 高版本：使用统一的API key管理系统（manage-api-keys）
  - 低版本：使用手动弹窗处理API Key
  - OpenAI-compatible设置现在在所有版本中都能正常显示
- ✅ **重要修复**：修复OpenAI-compatible模式设置显示问题
  - Speed滑块使用正确的默认值
  - API Key按钮根据版本自动适配
  - 添加constructor和dispose方法支持高版本
- ✅ **避免冲突**：设置保存位置从`tts`改为`SillyTavernTTS`
  - 不再与酒馆自带的TTS设置冲突
  - 已有设置需要重新配置（一次性）
- ✅ **性能优化**：改进音频播放状态同步
  - 监听原生音频事件（play/pause/ended）
  - 确保按钮状态与播放状态完全一致

### 历史版本 (2025-11-01)
- ✅ **重大更新**：自定义标签文本提取功能
  - 支持从 `<audio>` 标签提取文本（可开关）
  - 支持自定义HTML标签提取（如 `<content>`, `<thinking>` 等）
  - 优先级系统：自定义标签 > audio标签 > 全文本
  - 灵活配置，适应不同的消息格式需求
- ✅ 添加从 DOM 读取 `mes_text` 内容的功能
- ✅ 智能去除 HTML 标签，提取纯文本
- ✅ 新增可拖动的悬浮朗读按钮
- ✅ 优化 OpenAI Compatible 提供商的文本处理逻辑
- ✅ 添加播放状态视觉反馈
- ✅ 优化悬浮按钮：调整尺寸（45px），蓝色配色方案（#2A6BEF），超流畅拖动体验
- ✅ 拖动性能优化：使用原生DOM操作和transform，移除节流延迟，实现60fps流畅拖动
- ✅ **重要修复**：修复单个消息播放按钮问题，确保点击每个消息的播放按钮播放对应内容
- ✅ 优化OpenAI Compatible提供商：只在没有传入文本时才使用DOM文本，保证单个消息播放的准确性

---

# Provider Requirements.
Because I don't know how, or if you can, and/or maybe I am just too lazy to implement interfaces in JS, here's the requirements of a provider that the extension needs to operate.

### class YourTtsProvider
#### Required
Exported for use in extension index.js, and added to providers list in index.js
1. generateTts(text, voiceId)
2. fetchTtsVoiceObjects()
3. onRefreshClick()
4. checkReady()
5. loadSettings(settingsObject)
6. settings field
7. settingsHtml field

#### Optional
1. previewTtsVoice()
2. separator field
3. processText(text)

# Requirement Descriptions
### generateTts(text, voiceId)
Must return `audioData.type in ['audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/wave', 'audio/webm']`
Must take text to be rendered and the voiceId to identify the voice to be used

### fetchTtsVoiceObjects()
Required.
Used by the TTS extension to get a list of voice objects from the provider.
Must return an list of voice objects representing the available voices.
1. name: a friendly user facing name to assign to characters. Shows in dropdown list next to user.
2. voice_id: the provider specific id of the voice used in fetchTtsGeneration() call
3. preview_url: a URL to a local audio file that will be used to sample voices
4. lang: OPTIONAL language string

### getVoice(voiceName)
Required.
Must return a single voice object matching the provided voiceName. The voice object must have the following at least:
1. name: a friendly user facing name to assign to characters. Shows in dropdown list next to user.
2. voice_id: the provider specific id of the voice used in fetchTtsGeneration() call
3. preview_url: a URL to a local audio file that will be used to sample voices
4. lang: OPTIONAL language indicator

### onRefreshClick()
Required.
Users click this button to reconnect/reinit the selected provider.
Responds to the user clicking the refresh button, which is intended to re-initialize the Provider into a working state, like retrying connections or checking if everything is loaded.

### checkReady()
Required.
Return without error to let TTS extension know that the provider is ready.
Return an error to block the main TTS extension for initializing the provider and UI. The error will be put in the TTS extension UI directly.

### loadSettings(settingsObject)
Required.
Handle the input settings from the TTS extension on provider load.
Put code in here to load your provider settings.

### settings field
Required, used for storing any provider state that needs to be saved.
Anything stored in this field is automatically persisted under extension_settings[providerName] by the main extension in `saveTtsProviderSettings()`, as well as loaded when the provider is selected in `loadTtsProvider(provider)`.
TTS extension doesn't expect any specific contents.

### settingsHtml field
Required, injected into the TTS extension UI. Besides adding it, not relied on by TTS extension directly.

### previewTtsVoice()
Optional.
Function to handle playing previews of voice samples if no direct preview_url is available in fetchTtsVoiceObjects() response

### separator field
Optional.
Used when narrate quoted text is enabled.
Defines the string of characters used to introduce separation between between the groups of extracted quoted text sent to the provider. The provider will use this to introduce pauses by default using `...`

### processText(text)
Optional.
A function applied to the input text before passing it to the TTS generator. Can be async.
