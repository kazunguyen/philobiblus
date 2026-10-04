#!/usr/bin/env bash
mkdir -p ~/.local/bin
HELM_INSTALL_DIR=~/.local/bin ./get_helm.sh --no-sudo
echo 'export PATH=$PATH:~/.local/bin' >> ~/.bashrc
export PATH=$PATH:~/.local/bin
helm version
