#!/usr/bin/env bash
export PATH=$PATH:~/.local/bin
terraform -chdir=infrastructure/terraform/gke-app force-unlock -force 1790214587298740
