---
title: 对 AI 更友好的代码分割算法分析
date: 2026/01/14 17:56:51
categories:
  - AI
tags:
  - AI
banner_img: https://s2.loli.net/2026/01/13/WZuvxgBJw5MSC8E.png
index_img: https://s2.loli.net/2026/01/13/WZuvxgBJw5MSC8E.png
---
![](https://s2.loli.net/2026/01/13/WZuvxgBJw5MSC8E.png)


# 背景

因为最近在基于 [RAG](https://crossoverjie.top/2025/12/25/AI/deepwiki-rag-principle/) 对我们的 code repo 做 AI 分析，其中有一个非常核心的流程就是需要将我们的代码库里的源码进行分割，分割之后会作为 chunk 供 RAG 查询；然后再将查询到的 chunk 提交给 LLM 做分析。
<!--more-->

目前我们所使用的 [deepwiki-open](https://github.com/AsyncFuncAI/deepwiki-open/)对代码的分析使用的是最通用的 `text_splitter`:

![](https://s2.loli.net/2025/12/24/CVtdMlnwZzuHDGT.png)

分割方法也是最简单的按照 word 进行分割，普通场景下 `text_splitter` 够用，但对于我们这种存代码的场景就需要使用特殊的 `Spitter` 了；主要问题是它不理解语言结构，容易把函数/类等语义单元切断，导致检索召回片段不完整、上下文丢失。


# 算法对比

### 1. 基础文本切分
**简介**： 最原始的方法。不管代码逻辑，直接按字符长度或者空格硬切。就像切西瓜不管瓜瓤结构，每一刀切固定的厚度。

- **优点**：简单，适用于所有文本项目
- **缺点**：不适合代码项目，经常把一个完整的函数拦腰截断，大模型读起来云里雾里。

**代码示例**：

```Python
splitter = TextSplitter(**configs["text_splitter"])
document = splitter.split_text(code)
```

### 手搓 Tree-Sitter (参考[Claude-context](https://github.com/zilliztech/claude-context))

```ts
it('should split Java code from external file', async () => {  
    const filePath = 'AppService.java';  
      
    if (fs.existsSync(filePath)) {  
        const code = fs.readFileSync(filePath, 'utf-8');  
        console.log(`Reading Java file from: ${filePath}`);  
        console.log(`File size: ${code.length} characters`);  
          
        const chunks = await splitter.split(code, 'java', filePath);  
          
        console.log(`Split into ${chunks.length} chunks`);  
        chunks.forEach((chunk, index) => {  
            console.log(`>>>>Chunk ${index}: ${chunk.content}\n`);  
            console.log(`Metadata:`, chunk.metadata);  
            console.log(`Content preview: ${chunk.content.substring(0, 100)}...`);        });  
    } else {  
        console.warn(`File not found: ${filePath}`);  
    }  
});
```
原本是 [TS](https://github.com/zilliztech/claude-context/blob/2efe1e9aaf59f4f8c9aa3635b27326a2ae94fa1b/packages/core/src/splitter/ast-splitter.ts#L44) 写的，核心是使用 `tree-sitter` 做 AST 分析之后进行拆分，只是会在解析 AST 失败的时候使用 `LangChainCodeSplitter` 作为兜底。

![](https://s2.loli.net/2026/01/13/IyDPuQ1WK7RJfzS.png)

这部分没有找到现成的开源方案，于是我就按照 ts 代码翻译了一份 Python 的版本：

```python
splitter = AstCodeSplitter(chunk_size, chunk_overlap)  
chunks = splitter.split(code, "java", file_path)  
for i, chunk in enumerate(chunks):  
    print(f">>>>Chunk {i}: {chunk.content}\n")
```


| 方案                                                                                                                                                                                                                                                                                                                                                                                                                                          | 主要原理                                                                                                                                                                                                                                                                         | 代码友好度 | 适合场景                     | 主要缺点                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ------------------------ | -------------------------------------------------------------------- |
| **现有：deepwiki-open 的 TextSplitter（split_by=word）**                                                                                                                                                                                                                                                                                                                                                                                          | 纯通用文本切分：按 word/长度 + overlap 切块                                                                                                                                                                                                                                               | 弱     | 快速起步；纯文本/注释类内容较多；对精度要求不高 | 容易把函数/类切断；chunk 语义不完整；对代码检索召回不稳                                      |
| **[claude-context](https://github.com/zilliztech/claude-context)，没有 Python 库，得自己实现。**<br><br>**使用了  [LangChain CodeTextSplitter](https://reference.langchain.com/python/langchain_text_splitters/?_gl=1*1wsspz*_gcl_au*MTQxMjAyNDczOS4xNzY1NDQ2MTUx*_ga*NDcyOTM2OTM2LjE3NjU0NDYxNTI.*_ga_47WX3HKKY2*czE3NjY0NjkxODUkbzYkZzEkdDE3NjY0NzA0MDkkajYwJGwwJGgw#langchain_text_splitters.RecursiveCharacterTextSplitter.from_language) 兜底。**       | 使用 tree-sitter 解析 AST，支持 chunk_size 和 overlap。<br><br>生成 chunk 后再处理是否超过 chunk_size，内存占用大于 code-spitter<br><br>[相关代码](https://github.com/zilliztech/claude-context/blob/2efe1e9aaf59f4f8c9aa3635b27326a2ae94fa1b/packages/core/src/splitter/ast-splitter.ts#L109)             | 很强    | 多语言代码库 RAG、希望按函数/类分块     | **内存占用大于 code-spitter**                                              |
| **[wangxj03/code-splitter](https://github.com/wangxj03/code-splitter)（rust 编写有提供 [Python](https://pypi.org/project/code-splitter/) binding库）**<br><br>**参考了 **[benbrandt/text](https://github.com/benbrandt/text-splitter)[-splitter](https://github.com/wangxj03/code-splitter)** & [LlamaIndex's CodeSpiller](https://developers.llamaindex.ai/python/framework/module_guides/loading/node_parsers/modules/#codesplitter)（提供了 Python 库）** | 用 [tree-sitter](https://tree-sitter.github.io/tree-sitter/) 解析 AST，再按语法节点+ chunk 长度合并。<br><br>边遍历边合并，内存占用较小；[相关代码](https://github.com/wangxj03/code-splitter/blob/aa9a37e967c242b481a8a0ad1f663e5113d12a04/src/splitter.rs#L118)。<br><br>直接将语法数按照 chunk 分割，**没有处理 overlap；** | 很强    | 多语言代码库 RAG、希望按函数/类分块     | 依赖 tree-sitter grammar；集成复杂度略高<br><br>**没有处理 overlap，生成的上下文可能会不连续。** |
| **[LangChain CodeTextSplitter](https://reference.langchain.com/python/langchain_text_splitters/?_gl=1*1wsspz*_gcl_au*MTQxMjAyNDczOS4xNzY1NDQ2MTUx*_ga*NDcyOTM2OTM2LjE3NjU0NDYxNTI.*_ga_47WX3HKKY2*czE3NjY0NjkxODUkbzYkZzEkdDE3NjY0NzA0MDkkajYwJGwwJGgw#langchain_text_splitters.RecursiveCharacterTextSplitter.from_language)**                                                                                                             | 按语言特征分隔符（def/class/function等）切分（部分场景可结构化）<br><br>预设了一些语言的[关键字](https://github.com/langchain-ai/langchain/blob/master/libs/text-splitters/langchain_text_splitters/character.py#L172)。                                                                                        | 中-强   | 想快速落地、LangChain 生态、主流语言  | 多数实现偏“规则/正则”，复杂嵌套不如 AST 稳                                            |
| **[benbrandt/text](https://github.com/benbrandt/text-splitter)[-splitter](https://github.com/wangxj03/code-splitter)（语义/边界优先），rust 编写，**[有提供 Python binding 库](https://pypi.org/project/semantic-text-splitter/)**。**                                                                                                                                                                                                                       | 用 [tree-sitter](https://tree-sitter.github.io/tree-sitter/) 解析 AST。                                                                                                                                                                                                          | 强     |                          |                                                                      |
| **[LlamaIndex CodeSplitter](https://developers.llamaindex.ai/python/framework/module_guides/loading/node_parsers/modules/#codesplitter)**                                                                                                                                                                                                                                                                                                   | 用 [tree-sitter](https://tree-sitter.github.io/tree-sitter/) 解析 AST。只使用了最大字符分割，**没有处理 overlap；**                                                                                                                                                                              | 强     |                          | **没有处理 overlap；**                                                    |


# 总结


我们对同一个 Java 源码文件分别使用了 [claude-context](https://github.com/zilliztech/claude-context) 和 [text-splitter](https://github.com/benbrandt/text-splitter)进行了对比。

| 特性                 | `benbrandt:text-splitter-rust` | `claude-context-ts` / `claude-py-impl` |
| ------------------ | ------------------------------ | -------------------------------------- |
| **行边界对齐**          | **极佳**。每个 Chunk 都从新行开始，在行末结束。  | **较差**。经常在行中间甚至单词中间切断（如 `esDO`）。       |
| **语法完整性**          | **高**。尽量保持了方法签名或逻辑块的完整。        | **低**。由于是基于字符/Token 硬切，导致代码语义破碎。       |
| **重叠策略 (Overlap)** | **有意义的逻辑重叠**。在方法交界处进行重叠。       | **机械重叠**。简单的滑动窗口，不考虑代码逻辑。              |
| **Embedding 质量**   | **高**。由于没有破碎单词，向量表示的语义更精准。     | **中**。存在破碎的单词                          |

最后我们选择了 `benbrandt:text-splitter-rust` 的版本（提供了 Python binding 库）。

但对某个代码 repo 分析的效果与许多因素有关，比如 LLM 大模型质量、Embeding 的质量、提示词是否合理；其中的 Code Splitter 算法只是较小的一个环节。

这类需求随着大模型的迭代也需要常用常新，后续也会继续迭代相关知识。
#Blog 