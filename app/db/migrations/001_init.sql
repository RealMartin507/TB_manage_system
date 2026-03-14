-- 001_init.sql  图斑管理系统初始化建表脚本
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ============================================================
-- 图斑表
-- ============================================================
CREATE TABLE IF NOT EXISTS tb_plot (
    plot_id       TEXT    PRIMARY KEY,          -- 监测编号
    township      TEXT,                         -- 乡镇名称
    village       TEXT,                         -- 村名称
    area          REAL,                         -- 监测面积
    basic_farmland REAL,                        -- 占基本农田面积
    plot_type     TEXT,                         -- 图斑类型
    land_before   TEXT,                         -- 变化前地类
    land_after    TEXT,                         -- 变化后地类
    folder_path   TEXT,                         -- 本地资料文件夹路径
    created_at    DATETIME DEFAULT (datetime('now', 'localtime'))
);

-- ============================================================
-- 填报平台配置表（task 外键依赖，先建）
-- ============================================================
CREATE TABLE IF NOT EXISTS tb_platform (
    platform_id   INTEGER PRIMARY KEY AUTOINCREMENT,
    platform_name TEXT    NOT NULL,
    platform_url  TEXT,
    sort_order    INTEGER DEFAULT 0
);

-- ============================================================
-- 任务表
-- ============================================================
CREATE TABLE IF NOT EXISTS tb_task (
    task_id       INTEGER PRIMARY KEY AUTOINCREMENT,
    task_name     TEXT    NOT NULL,             -- 任务名称
    source        TEXT,                         -- 任务来源
    platform_id   INTEGER REFERENCES tb_platform(platform_id) ON DELETE SET NULL,
    created_time  DATE,                         -- 任务建立时间
    deadline      DATE,                         -- 任务截止时间
    import_time   DATETIME DEFAULT (datetime('now', 'localtime'))
);

-- ============================================================
-- 图斑-任务关联表
-- ============================================================
CREATE TABLE IF NOT EXISTS tb_plot_task (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    plot_id           TEXT    NOT NULL REFERENCES tb_plot(plot_id) ON DELETE CASCADE,
    task_id           INTEGER NOT NULL REFERENCES tb_task(task_id) ON DELETE CASCADE,
    seq_no            INTEGER,                  -- 序号（原始导入序号）
    project_name      TEXT,                     -- 项目名称
    land_unit         TEXT,                     -- 用地单位
    approval_doc      TEXT,                     -- 批单（文号文本）
    land_supply_doc   TEXT,                     -- 供地资料（文号文本）
    legality          TEXT,                     -- 合法性判定：合法/违法/其他
    internal_review   TEXT,                     -- 内审
    field_survey      TEXT,                     -- 外业组调查说明
    report_status     TEXT DEFAULT '待报',      -- 填报状态：待报/已报/退回
    reject_reason     TEXT,                     -- 退回原因
    archive_status    TEXT,                     -- 存档
    dispatch          TEXT,                     -- 调度（多选逗号分隔）
    overlap_situation TEXT,                     -- 批单套合情况
    overlap_ratio     REAL,                     -- 批单套合比例
    overlap_area      REAL,                     -- 套合面积
    remark            TEXT                      -- 备注
);

-- ============================================================
-- 导入映射模板表
-- ============================================================
CREATE TABLE IF NOT EXISTS tb_import_template (
    template_id   INTEGER PRIMARY KEY AUTOINCREMENT,
    template_name TEXT    NOT NULL,
    mapping_json  TEXT    NOT NULL DEFAULT '{}',
    created_at    DATETIME DEFAULT (datetime('now', 'localtime'))
);

-- ============================================================
-- 导出模板表
-- ============================================================
CREATE TABLE IF NOT EXISTS tb_export_template (
    template_id   INTEGER PRIMARY KEY AUTOINCREMENT,
    template_name TEXT    NOT NULL,
    fields_json   TEXT    NOT NULL DEFAULT '[]',
    created_at    DATETIME DEFAULT (datetime('now', 'localtime'))
);
