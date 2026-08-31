#!/bin/bash
# 部署報告引擎到 Supabase（唯一正本：supabase/functions/generate-report/index.ts）
set -e
cd "$(dirname "$0")"
supabase functions deploy generate-report --project-ref nvlaprxcuyokolpfwoto --no-verify-jwt
echo "✅ generate-report 已部署"
