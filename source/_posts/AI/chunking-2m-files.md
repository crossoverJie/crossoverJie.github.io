---
title: AI 如何用 AST 每天对 200 万+ 文件做高质量分块（用于代码搜索）
date: 2025/12/29 17:56:51
categories:
  - AI
tags:
  - AI
banner_img: https://s2.loli.net/2025/12/29/4WHveihZ6utrx9O.png
index_img: https://s2.loli.net/2025/12/29/4WHveihZ6utrx9O.png
---
![](https://s2.loli.net/2025/12/29/4WHveihZ6utrx9O.png)

原文链接：[https://github.com/sweepai/sweep/blob/main/docs/pages/blogs/chunking-2m-files.mdx](https://github.com/sweepai/sweep/blob/main/docs/pages/blogs/chunking-2m-files.mdx)

---


最近在研究 Code Splitter 的算法，发现 [llama_index](https://developers.llamaindex.ai/python/framework/module_guides/loading/node_parsers/modules/#codesplitter) 的代码分割使用的是 sweepai 的代码分割算法，同时还提供了一篇博客，也就有了这篇文章。

![](https://s2.loli.net/2025/12/29/pVsnHRh3FUacw5e.png)

<!--more-->

初始化任何向量存储都需要对大型文档进行切分（chunking）以进行高效搜索。

为什么不能直接对整个文件做嵌入（embed）？以我们主 API 的 [endpoint 文件](https://github.com/sweepai/sweep/blob/b267b613d4c706eaf959fe6789f11e9a856521d1/sweepai/api.py) 为例：

1. 导入包
2. 常量声明
3. 辅助函数
4. 每个 webhook endpoint 的业务逻辑

如果我搜索 “GitHub Action run”，它应该匹配检查 “check_runs completed” 事件的那个 switch case 块（参见 [代码片段](https://github.com/sweepai/sweep/blob/b267b613d4c706eaf959fe6789f11e9a856521d1/sweepai/api.py#L295-L313)）。但那只是 400 多行代码中的大约 20 行，即使是完美的搜索算法也只会把相似性视为 5%。如果我们把 400 行切成 20 个每个 20 行的块，就更容易匹配到正确的 switch case 块。

![](https://s2.loli.net/2025/12/29/GPSgUirMceTzKQ6.png)


那我们如何产生 20 行的块？一个简单的办法是均匀地把 400 行切成每 20 行一块。

但是，这种方法行不通。语义上相关的代码不会被保留在一起，且会丢失上下文。例如，函数头可能会被和实现体分离。

我们当前的代码切分算法每天处理 **200 万+ 文件**，并且已经[开源了](https://github.com/sweepai/sweep/blob/b267b613d4c706eaf959fe6789f11e9a856521d1/sweepai/utils/utils.py#L48-L126)！

## 约束 🚧

大多数用于 RAG（检索增强生成）的切分器按 token 数量做上限。为简化处理，我们决定使用字符数，上限设为 1500。

这是因为代码的平均 token 与字符比约为 1:5（300 tokens），而嵌入模型通常受 512 tokens 限制。进一步地，1500 字符大约对应 40 行，大致等同于一个小到中等大小的函数或类。

挑战在于尽可能接近 1500 字符，同时保证块在语义上保持一致且相关上下文被保留。

## 开箱即用的解决方案 📦

最简单的现成解决方案是 [Langchain 的递归切分器（recursive chunker）](https://reference.langchain.com/python/langchain_text_splitters/?_gl=1*1wsspz*_gcl_au*MTQxMjAyNDczOS4xNzY1NDQ2MTUx*_ga*NDcyOTM2OTM2LjE3NjU0NDYxNTI.*_ga_47WX3HKKY2*czE3NjY0NjkxODUkbzYkZzEkdDE3NjY0NzA0MDkkajYwJGwwJGgw#langchain_text_splitters.RecursiveCharacterTextSplitter.split_text)。总体思路：

1. 用顶层分隔符拆分文本（先用 class，然后是 function 定义，然后是方法等）
2. 迭代每个区块并贪心地把它们串联直到超过字符限制。对于过大的区块，使用下一级分隔符递归切分。

示例伪代码：

```python
delimiters = ["\nclass ", "\ndef ", "\n\tdef ", "\n\n", "\n", " ", ""]
def chunk(text: str, delimiter_index: int = 0, MAX_CHARS: int = 1500) -> list[str]:
	delimiter = delimiters[delimiter_index]
	new_chunks = []
	current_chunk = ""
	for section in text.split(delimiter):
		if len(section) > MAX_CHARS:
			# Section is too big, recursively chunk this section
			new_chunks.append(current_chunk)
			current_chunk = ""
			new_chunks.extend(chunk(section, delimiter_index + 1, MAX_CHARS)
		elif len(current_chunk) + len(section) > MAX_CHARS:
			# Current chunk is max size
			new_chunks.append(current_chunk)
			current_chunk = section
		else:
			# Concatenate section to current_chunk
			current_chunk += section
	return new_chunks
```

针对每种语言我们会使用不同的分隔符。

### 示例

完整示例文件请见：[https://gist.github.com/kevinlu1248/ded3ea33dcd8a9bd08078f4c64eb9268](https://gist.github.com/kevinlu1248/ded3ea33dcd8a9bd08078f4c64eb9268)

#### 示例 #1
基于我们处理 GitHub Action 运行的 `on_check_suite.py` 文件。一个糟糕的切分把字符串拼接声明与其内容分开了。❌

```python
...

def on_check_suite(request: CheckRunCompleted):
    logger.info(f"Received check run completed event for {request.repository.full_name}")
    g = get_github_client(request.installation.id)
    repo = g.get_repo(request.repository.full_name)
    if not get_gha_enabled(repo):
        logger.info(f"Skipping github action for {request.repository.full_name} because it is not enabled")
        return None
    pr = repo.get_pull(request.check_run.pull_requests[0].number)
    num_pr_commits = len(list(pr.get_commits()))
    if num_pr_commits > 20:
        logger.info(f"Skipping github action for PR with {num_pr_commits} commits")
        return None
    logger.info(f"Running github action for PR with {num_pr_commits} commits")
    logs = download_logs(
        request.repository.full_name,
        request.check_run.run_id,
        request.installation.id
    )
    if not logs:
        return None
    logs = clean_logs(logs)
    extractor = GHAExtractor()
    logger.info(f"Extracting logs from {request.repository.full_name}, logs: {logs}")
    problematic_logs = extractor.gha_extract(logs)
    if problematic_logs.count("
") > 15:
        problematic_logs += "

========================================

There are a lot of errors. This is likely a larger issue with the PR and not a small linting/type-checking issue."
    comments = list(pr.get_issue_comments())
    if len(comments) >= 2 and problematic_logs == comments[-1].body and comments[-2].body == comments[-1].body:
        comment = pr.as_issue().create_comment(log_message.format(error_logs=problematic_logs) + "

I'm getting the same errors 3 times in a row, so I will stop working on fixing this PR.")
        logger.warning("Skipping logs because it is duplicated")
        raise Exception("Duplicate error logs")
    print(problematic_logs)
    comment = pr.as_issue().create_comment(log_message.format(error_logs=problematic_logs))
    on_comment(
        repo_full_name=request.repository.full_name,
        repo_description=request.repository.description,
        comment=problematic_logs,
        pr_path=None,
        pr_line_position=None,
        username=request.sender.login,
        installation_id=request.installation.id,
        pr_number=request.check_run.pull_requests[0].number,
        comment_id=comment.id,
        repo=repo,
    )
    return {"success": True}
```

#### 示例 #2
基于 LlamaIndex 的 `BaseIndex.ts` 文件（声明向量存储的 ABC）。糟糕的切分把类的方法实现与其头部分离了。❌

```tsx
...

export class IndexDict extends IndexStruct {
  nodesDict: Record<string, BaseNode> = {};
  docStore: Record<string, Document> = {}; // FIXME: this should be implemented in storageContext
  type: IndexStructType = IndexStructType.SIMPLE_DICT;

========================================

getSummary(): string {
    if (this.summary === undefined) {
      throw new Error("summary field of the index dict is not set");
    }
    return this.summary;
  }

  addNode(node: BaseNode, textId?: string) {
    const vectorId = textId ?? node.id_;
    this.nodesDict[vectorId] = node;
  }

  toJson(): Record<string, unknown> {
    return {
      ...super.toJson(),
      nodesDict: this.nodesDict,
      type: this.type,
    };
  }
}

...
```

### 问题 🤔

然而，这个切分器存在严重问题：

1. 对 Python 效果不错，但对大括号密集的语言（如 JS）和基于 XML 的语言（如 HTML）会在不可预期的地方断开。
   - 此外，`str.split` 对这些更复杂的语法（如 JS、HTML）效果不好。
   - 例如，即使对 Python，也会把像 `problematic_logs += \"` 与其余字符串错误地分割。
2. 目前仅支持 16 种语言，不支持 JSX、Typescript、EJS 和 C#。
   - JSX/TSX 占我们用户群的大部分。
3. Langchain 会删除重要分隔符（比如 “def” 和 “class”）。

## 我们的解决方案 🧠

根本问题是用一系列的 `str.split` 和分隔符来近似所谓的“具体语法树（CST）”是太原始了。

为了解决这个问题，我们直接使用 CST 解析器。如何获得大量语言的 CST 解析器？幸运的是，库 [tree-sitter](https://tree-sitter.github.io/) 提供了标准化访问 113 种编程语言 CST 解析器的方式，并且速度快（用 C 写）且无额外依赖。

新的算法在高层上与 Langchain 类似，步骤如下：

1. 要对一个父节点进行切分，我们遍历其子节点并贪心地把它们打包在一起。对于每个子节点：
2. 如果当前 chunk 太大，将其加入结果列表并清空当前 bundle
3. 如果下一个子节点本身太大，则递归切分该子节点并把结果加入列表
4. 否则，将该子节点的文本拼接到当前 chunk
5. 对最终结果做后处理：把单行的 chunk 与下一个 chunk 合并
6. 这样保证不会出现过小（意义不大）的 chunk

示例伪代码：

```python
from tree_sitter import Node

def chunk_node(node: Node, text: str, MAX_CHARS: int = 1500) -> list[str]:
	new_chunks = []
	current_chunk = ""
	for child in node.children:
		if child.end_byte - child.start_byte > MAX_CHARS:
			new_chunks.append(current_chunk)
			current_chunk = ""
			new_chunks.extend(chunk_node(child, text, MAX_CHARS)
		elif len(current_chunk) + child.end_byte - child.start_byte > MAX_CHARS:
			new_chunks.append(current_chunk)
			current_chunk = text[node.start_byte:node.end_byte]
		else:
			current_chunk += text[node.start_byte:node.end_byte]
	return new_chunks
```

### 示例

完整切分结果请见：[https://gist.github.com/kevinlu1248/49a72a1978868775109c5627677dc512](https://gist.github.com/kevinlu1248/49a72a1978868775109c5627677dc512)

#### 示例 #1
基于我们的 `on_check_suite.py` 文件。正确的切分；在 if 语句之前做切分，而不是把 if 语句与其主体分开。✅

```python
...

def on_check_suite(request: CheckRunCompleted):
    logger.info(f"Received check run completed event for {request.repository.full_name}")
    g = get_github_client(request.installation.id)
    repo = g.get_repo(request.repository.full_name)
    if not get_gha_enabled(repo):
        logger.info(f"Skipping github action for {request.repository.full_name} because it is not enabled")
        return None
    pr = repo.get_pull(request.check_run.pull_requests[0].number)
    num_pr_commits = len(list(pr.get_commits()))
    if num_pr_commits > 20:
        logger.info(f"Skipping github action for PR with {num_pr_commits} commits")
        return None
    logger.info(f"Running github action for PR with {num_pr_commits} commits")
    logs = download_logs(
        request.repository.full_name,
        request.check_run.run_id,
        request.installation.id
    )
    if not logs:
        return None
    logs = clean_logs(logs)
    extractor = GHAExtractor()
    logger.info(f"Extracting logs from {request.repository.full_name}, logs: {logs}")
    problematic_logs = extractor.gha_extract(logs)
    if problematic_logs.count("\n") > 15:
        problematic_logs += "\n\nThere are a lot of errors. This is likely a larger issue with the PR and not a small linting/type-checking issue."
    comments = list(pr.get_issue_comments())

==========

    if len(comments) >= 2 and problematic_logs == comments[-1].body and comments[-2].body == comments[-1].body:
        comment = pr.as_issue().create_comment(log_message.format(error_logs=problematic_logs) + "\n\nI'm getting the same errors 3 times in a row, so I will stop working on fixing this PR.")
        logger.warning("Skipping logs because it is duplicated")
        raise Exception("Duplicate error logs")
    print(problematic_logs)
    comment = pr.as_issue().create_comment(log_message.format(error_logs=problematic_logs))
    on_comment(
        repo_full_name=request.repository.full_name,
        repo_description=request.repository.description,
        comment=problematic_logs,
        pr_path=None,
        pr_line_position=None,
        username=request.sender.login,
        installation_id=request.installation.id,
        pr_number=request.check_run.pull_requests[0].number,
        comment_id=comment.id,
        repo=repo,
    )
```

#### 示例 #2
基于 LlamaIndex 的 `BaseIndex.ts` 文件。我们的切分器正确地在导出的类和函数之间切分。✅

```tsx
...

export class IndexDict extends IndexStruct {
  nodesDict: Record<string, BaseNode> = {};
  docStore: Record<string, Document> = {}; // FIXME: this should be implemented in storageContext
  type: IndexStructType = IndexStructType.SIMPLE_DICT;

  getSummary(): string {
    if (this.summary === undefined) {
      throw new Error("summary field of the index dict is not set");
    }
    return this.summary;
  }

  addNode(node: BaseNode, textId?: string) {
    const vectorId = textId ?? node.id_;
    this.nodesDict[vectorId] = node;
  }

  toJson(): Record<string, unknown> {
    return {
      ...super.toJson(),
      nodesDict: this.nodesDict,
      type: this.type,
    };
  }
}

========================================

export function jsonToIndexStruct(json: any): IndexStruct {
  if (json.type === IndexStructType.LIST) {
    const indexList = new IndexList(json.indexId, json.summary);
    indexList.nodes = json.nodes;
    return indexList;
  } else if (json.type === IndexStructType.SIMPLE_DICT) {
    const indexDict = new IndexDict(json.indexId, json.summary);
    indexDict.nodesDict = json.nodesDict;
    return indexDict;
  } else {
    throw new Error(`Unknown index struct type: ${json.type}`);
  }
}

...
```

### 算法其余部分 🤖

1. 依次遍历支持的语言列表，直到某个解析器成功解析代码
2. 对解析出的语法树根节点进行切分
3. 如果没有任何语言成功解析，则使用一个普通的切分器：每次取 40 行，并在块间保留 15 行重叠（覆盖），这种情况约占 0.1%

示例伪代码：

```python
language_names = ["python", "java", "cpp", "go", "rust", "ruby", "php"] # and more

# Installing the parsers
languages = {}
for language in LANGUAGE_NAMES:
   subprocess.run(f"git clone https://github.com/tree-sitter/tree-sitter-{language} cache/tree-sitter-{language}", shell=True)
  for language in LANGUAGE_NAMES:
      Language.build_library(f'cache/build/{language}.so', [f"cache/tree-sitter-{language}"])
  self.languages = {language: Language(f"cache/build/{language}.so", language) for language in LANGUAGE_NAMES}

def chunk(text: str, MAX_CHARS: int = 1500) -> list[str]:
	# Determining the language
	for language_name in language_names:
    language = languages[language_name]
    parser = Parser()
    parser.set_language(language)
    tree = parser.parse(bytes(text, "utf-8"))
    if not tree.root_node.children or tree.root_node.children[0].type != "ERROR":
        file_language = language
        break
    logger.warning(f"Not language {language_name}")

	# Smart chunker
	if file_language:
      return chunk_node(tree.root_node, text, max_chunk_size)

	# Naive algorithm
  source_lines = file_content.split('\n')
  num_lines = len(source_lines)
  logger.info(f"Number of lines: {num_lines}")
  chunks = []
  start_line = 0
  while start_line < num_lines and num_lines > overlap:
      end_line = min(start_line + chunk_size, num_lines)
      chunk = '\n'.join(source_lines[start_line:end_line])
      chunks.append(chunk)
      start_line += chunk_size - overlap
	return chunks
```

在 Sweep，我们目前安装了 Python、Java、C++、Go、Rust、Ruby、PHP、C#、嵌入式模板（ERB & EJS）、Markdown、Vue 和 TSX。另请注意：C++ 覆盖 C，TSX 覆盖 JS、JSX 和 TS。

## 陷阱 🕳️

不幸的是，`tree-sitter` 有时并不可靠，很多解析器由社区维护：

- TSX 解析器在无法解析时会挂起而不是返回错误
- 此外，tree-sitter 的核心用 C 写成。在我们的 serverless 生产环境中运行需要一套复杂的方法来缓存已编译的 C 二进制，移动到可执行目录，并使用 Python 包装器去调用它们
- 有些解析器在子节点之间留下空隙。我们通过合并（coalescing）解决了这个问题
- 没有一种解析器会在解析错误的语言时都以相同方式报错
- 有些解析器将根节点标记为 “ERROR”，而有些则把第一个 child 标为 ERROR

我们通过在遇到这些错误（例如 TSX 挂起或其他不可靠行为）时回退到朴素切分器来规避问题，并将 TSX 优先级放在最后。同时我们会优先尝试与文件扩展名相对应的语言解析器。

## 未来 🔮


这个算法现在已通过 https://github.com/jerryjliu/llama_index/pull/7100 集成到 LlamaIndex 中。

另一个问题是，文件中相距较远的代码片段可能仍然需要共享上下文。例如，一个类的方法可能需要类头的上下文，长函数也需要函数签名。一个可能的改进是采用类似以下的格式来保留上下文：

```python
class Foo:
  ...
  def bar(self):
      pass
```

我们可以考虑使用 [universal ctags](https://github.com/universal-ctags/ctags) 或类似工具以实现更简单、更通用的解析，或者在手工标注的切分上训练一个自定义的 spaCy sentencizer，但那可能有点过度设计。
