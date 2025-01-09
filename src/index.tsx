import { ActionPanel, Action, List, showToast, Toast } from "@raycast/api";
import { useEffect, useState } from "react";
import { execSync } from "child_process";
import { homedir } from "os";

const execCommand = (command: string): string => {
  try {
    const shellCommand = `
      eval "$(/opt/homebrew/bin/brew shellenv)"
      eval "$(pyenv init -)"
      ${command}
    `;

    return execSync(shellCommand, {
      shell: '/bin/zsh',
      env: {
        ...process.env,
        HOME: homedir(),
      },
      encoding: 'utf-8',
    }).toString().trim();
  } catch (error) {
    throw new Error(`执行命令失败: ${error.message}`);
  }
};

interface Version {
  name: string;
  isInstalled?: boolean;
}

interface MenuItem {
  id: string;
  title: string;
  subtitle: string;
}

export default function Command() {
  const [selectedItem, setSelectedItem] = useState<string>("");
  const [versions, setVersions] = useState<Version[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pyenvAvailable, setPyenvAvailable] = useState(true);

  useEffect(() => {
    // 验证 pyenv 是否可用
    try {
      execCommand('pyenv --version');
    } catch (error) {
      setPyenvAvailable(false);
      showToast({
        style: Toast.Style.Failure,
        title: "pyenv 不可用",
        message: String(error),
      });
    }
  }, []);

  const mainMenuItems: MenuItem[] = [
    { id: "current", title: "查看当前Python版本", subtitle: "显示当前激活的Python版本" },
    { id: "switch", title: "切换Python版本", subtitle: "切换到其他已安装的Python版本" },
    { id: "install", title: "安装Python版本", subtitle: "安装新的Python版本" },
    { id: "uninstall", title: "卸载Python版本", subtitle: "卸载已安装的Python版本" },
  ];

  useEffect(() => {
    if (selectedItem && pyenvAvailable) {
      loadVersions();
    }
  }, [selectedItem, pyenvAvailable]);

  async function loadVersions() {
    setIsLoading(true);
    try {
      if (selectedItem === "current") {
        const currentVersion = execCommand('pyenv version');
        setVersions([{ name: currentVersion.split(" ")[0] }]);
      } else if (selectedItem === "switch" || selectedItem === "uninstall") {
        const installed = execCommand('pyenv versions');
        const versions = installed
          .split("\n")
          .map((v) => ({ name: v.trim().replace("* ", "") }))
          .filter((v) => v.name && !v.name.includes("system"));
        setVersions(versions);
      } else if (selectedItem === "install") {
        const available = execCommand('pyenv install --list');
        const versions = available
          .split("\n")
          .slice(1)
          .map((v) => ({ name: v.trim() }))
          .filter((v) => v.name && !v.name.includes("system"));
        setVersions(versions);
      }
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "加载版本列表失败",
        message: String(error),
      });
    }
    setIsLoading(false);
  }

  async function handleVersionAction(version: string) {
    try {
      if (selectedItem === "switch") {
        execCommand(`pyenv global ${version}`);
        await showToast({ title: `已切换到 ${version}`, style: Toast.Style.Success });
      } else if (selectedItem === "install") {
        await showToast({ title: `正在安装 ${version}...`, style: Toast.Style.Animated });
        execCommand(`pyenv install ${version}`);
        await showToast({ title: `已安装 ${version}`, style: Toast.Style.Success });
      } else if (selectedItem === "uninstall") {
        execCommand(`pyenv uninstall -f ${version}`);
        await showToast({ title: `已卸载 ${version}`, style: Toast.Style.Success });
      }
      await loadVersions();
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "操作失败",
        message: String(error),
      });
    }
  }

  if (!pyenvAvailable) {
    return (
      <List>
        <List.Item
          title="错误"
          subtitle="pyenv 未正确安装或配置"
          actions={
            <ActionPanel>
              <Action.OpenInBrowser
                title="查看 pyenv 安装指南"
                url="https://github.com/pyenv/pyenv#installation"
              />
            </ActionPanel>
          }
        />
      </List>
    );
  }

  if (selectedItem === "") {
    return (
      <List navigationTitle="Python版本管理">
        {mainMenuItems.map((item) => (
          <List.Item
            key={item.id}
            title={item.title}
            subtitle={item.subtitle}
            actions={
              <ActionPanel>
                <Action title="选择" onAction={() => setSelectedItem(item.id)} />
              </ActionPanel>
            }
          />
        ))}
      </List>
    );
  }

  return (
    <List
      isLoading={isLoading}
      navigationTitle="Python版本管理"
      searchBarPlaceholder="搜索Python版本..."
    >
      {selectedItem === "current" ? (
        versions.map((version) => (
          <List.Item
            key={version.name}
            title="当前Python版本"
            subtitle={version.name}
            actions={
              <ActionPanel>
                <Action title="返回" onAction={() => setSelectedItem("")} />
              </ActionPanel>
            }
          />
        ))
      ) : (
        versions.map((version) => (
          <List.Item
            key={version.name}
            title={version.name}
            actions={
              <ActionPanel>
                <Action
                  title={
                    selectedItem === "switch"
                      ? "切换到此版本"
                      : selectedItem === "install"
                      ? "安装此版本"
                      : "卸载此版本"
                  }
                  onAction={() => handleVersionAction(version.name)}
                />
                <Action title="返回" onAction={() => setSelectedItem("")} />
              </ActionPanel>
            }
          />
        ))
      )}
    </List>
  );
} 