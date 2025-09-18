---
title: Git cherry-pick 使用小技巧
date: 2025/09/18 17:56:51
categories:
  - git
tags:
  - cherry-pick
banner_img: https://s2.loli.net/2025/09/11/Kq7YjvrRp5MknFQ.png
index_img: https://s2.loli.net/2025/09/11/Kq7YjvrRp5MknFQ.png
---

# 背景

前段时间我在实现 StarRocks 的一个关于[资源限制的特性](https://github.com/StarRocks/starrocks/pull/62705)，由于该功能需要基于最新的 3.5 tag 进行开发，所以我需要需要从 3.5 的 tag 里拉出一个分支（3.5-feature）开发完成后再向上游的 main 分支提交 PR。

<!--more-->

# 解决方案

如果直接使用 3.5-feature 分支向 main 提交 PR 会有很多之前的 commit 导致文件修改很多，所以得换一种方式提交这些变更。
## stash
解决这个问题的办法也蛮多的，第一种是使用 `git stash`。

这个可以先将修改临时保存，然后再需要的时候再将 stash 里的数据应用到当前分支。

但这样有几个问题：
- 开发的过程中没法提交代码了，提交之后就没法保存到 stash 里，没有提交代码总会有丢数据的风险。
- 后续需要多次提交时，stash 也不支持，毕竟 stash 之后当前分支的代码就没有了。


## 手动复制

第二种办法那就是先把代码提交到 `3.5-feature`，然后重新基于 main 分支重新拉取一个分支，再手动对比 `3.5-feature` 的提交记录进行修改。

这样的好处是提交记录比较干净，但坏处是改动较多的话容易遗漏代码，并且每次在 `3.5-feature` 的改动都需要人工同步过来。

## cherry-pick

我第一次看到 `cherry-pick` 的用法还是在 `Pulsar` 社区里，经常看到有 [PR](https://github.com/apache/pulsar/pull/24571) 将某个在 main 分支的特性 cherry-pick 到其他分支。

![](https://s2.loli.net/2025/09/17/wzxrVbLK8fqQFWa.png)


或者是一些重要的安全更新也需要在一些维护版本的分支进行修复。
![](https://s2.loli.net/2025/09/17/yjZHLF1AQYOB7MK.png)


`cherry-pick` 的主要作用是将其他分支的特定提交精确合并到当前分支，以便在不合并整个分支的情况下同步修复、`hot-fix` 或者是复用代码；

使用流程如下：

```shell
git checkout main 
git pull origin main 
git checkout -b main-feature
```

```shell
# 只pick你真正需要的功能相关提交

# 你的核心功能提交1 
git cherry-pick abc123 

# 你的核心功能提交2
git cherry-pick def456 ...
```

![](https://s2.loli.net/2025/09/17/rgcXnMkpdE3v1Z2.png)

> 这里的 abc123 和 def456 都是提交记录的 hash 值，可以通过 git log 命令获取；也可以在 github 的提交记录页面复制。


如果碰到冲突先解决，然后执行：
```shell
git cherry-pick --continue

git push origin main-feature
```

假设存在两个分支：
```shell
    a - b - c - d   main
         \
           e - f - g main-feature
```

```shell
git cherry-pick f
```
现在需要将 `main-feature` 分支里的 `f` 提交到 main 分支，cherry-pick 之后会变成这样：

```shell
    a - b - c - d - f   main
         \
           e - f - g main-feature
```
f 这个提交就会被追加到头部。
# 适用场景

cherry-pick 主要应用与一些小的修复，安全更新、紧急 bug 的处理，如果一个分支上的大部分 commit 都要被 cherry-pick 到另一个分支，不如考虑直接 使用 merge 或者 rebase。

就像这个功能的名称一样：摘樱桃。选择合适的果子进行摘取，而不是把所有的提交都合并过去。



#Blog #Github #Git