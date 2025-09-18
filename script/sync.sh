
#!/bin/bash

# 切换到指定目录
path="/Users/chenjie/Documents/Obsidian Vault/✍️Blog"
target_base="/Users/chenjie/Documents/Hexo/source/_posts"

cd "${path}"

# 递归获取指定目录下最新修改的文件（完整路径）
latest_file_full=$(find "${path}" -type f -exec stat -f "%m %N" {} \; | sort -nr | head -1 | cut -d' ' -f2-)

# 检查是否找到文件
if [ -z "$latest_file_full" ]; then
    echo "未找到任何文件"
    exit 1
fi

# 获取相对路径（去掉基础路径）
latest_file_relative=${latest_file_full#${path}/}

# 获取文件名
latest_file=$(basename "$latest_file_relative")

# 获取目录路径（相对于基础路径）
latest_file_dir=$(dirname "$latest_file_relative")

# 如果目录是 "."，说明文件在根目录下
if [ "$latest_file_dir" = "." ]; then
    target_path="${target_base}"
else
    target_path="${target_base}/${latest_file_dir}"
fi

# 创建目标目录（如果不存在）
mkdir -p "$target_path"

# 复制文件
cp "$latest_file_full" "$target_path/"

echo "Ready to publish"
echo "Latest file: $latest_file_full"
echo "Copied to: $target_path/$latest_file"
echo "Copy completed successfully!!!"


# 切换到目标目录执行git操作
cd "$target_base"

echo "Switching to git repository: $target_base"

# 添加所有更改到暂存区
git add .

# 提交更改（使用文件名作为提交信息）
commit_message="Add/Update: $latest_file"
git commit -m "$commit_message"

# 检查提交是否成功
if [ $? -eq 0 ]; then
    echo "Git commit successful: $commit_message"

    # 推送到远程仓库
    echo "Pushing to remote repository..."
    git push

    if [ $? -eq 0 ]; then
        echo "Git push successful!!!"
        echo "Blog post published successfully!"
    else
        echo "Git push failed!"
        exit 1
    fi
else
    echo "Git commit failed!"
    exit 1
fi