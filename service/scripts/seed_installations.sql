-- 安装登记测试数据（PostgreSQL）
-- 用法: psql $DATABASE_URL -f service/scripts/seed_installations.sql
-- 注意：当前后端 API 仍读内存 store，落库后需改 work_order_service 才走库

CREATE TABLE IF NOT EXISTS work_orders (
    id              SERIAL PRIMARY KEY,
    order_no        VARCHAR(32)  NOT NULL UNIQUE,
    sales_name      VARCHAR(64)  NOT NULL DEFAULT '',
    store_name      VARCHAR(128) NOT NULL DEFAULT '',
    customer_name   VARCHAR(128) NOT NULL DEFAULT '',
    address         VARCHAR(256) NOT NULL DEFAULT '',
    contact         VARCHAR(64)  NOT NULL DEFAULT '',
    contact_phone   VARCHAR(20)  NOT NULL DEFAULT '',
    install_date    VARCHAR(10)  NOT NULL DEFAULT '',
    remark          VARCHAR(512) NOT NULL DEFAULT '',
    status          VARCHAR(16)  NOT NULL DEFAULT '待派工',
    installer       VARCHAR(64)  NOT NULL DEFAULT '',
    device_supplier VARCHAR(64)  NOT NULL DEFAULT '',
    device_model    VARCHAR(64)  NOT NULL DEFAULT '',
    mac             VARCHAR(64)  NOT NULL DEFAULT '',
    imei            VARCHAR(32)  NOT NULL DEFAULT '',
    sim_supplier    VARCHAR(64)  NOT NULL DEFAULT '',
    operator        VARCHAR(16)  NOT NULL DEFAULT '',
    iccid           VARCHAR(32)  NOT NULL DEFAULT '',
    backup_iccid    VARCHAR(32)  NOT NULL DEFAULT '',
    install_remark  VARCHAR(512) NOT NULL DEFAULT '',
    fail_reason     VARCHAR(256) NOT NULL DEFAULT '',
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_work_orders_install_date ON work_orders (install_date);
CREATE INDEX IF NOT EXISTS idx_work_orders_mac ON work_orders (mac);
CREATE INDEX IF NOT EXISTS idx_work_orders_iccid ON work_orders (iccid);
CREATE INDEX IF NOT EXISTS idx_work_orders_customer ON work_orders (customer_name);
CREATE INDEX IF NOT EXISTS idx_work_orders_store ON work_orders (store_name);

TRUNCATE TABLE work_orders RESTART IDENTITY;

INSERT INTO work_orders (
    order_no, sales_name, store_name, customer_name, address, contact, contact_phone,
    install_date, remark, status, installer, device_supplier, device_model,
    mac, imei, sim_supplier, operator, iccid, backup_iccid, install_remark
) VALUES
(
    'GD-20251122-031', '张三', 'B3咖啡（新天地）', 'B3咖啡', '黄浦区新天地广场B3层', '王店长', '13816882001',
    '2025-11-22', '', '已安装', '赵云', '华为', 'HUAWEI',
    '4HB7S24C26000931', '', '移动', '移动', '8986112320403848756', '89860487152590411606', ''
),
(
    'GD-20251018-024', '张三', 'Manner咖啡（南京西路）', 'Manner咖啡', '静安区南京西路1788号1F', '李经理', '13917665002',
    '2025-10-18', '要求隐藏布线', '已安装', '赵云', '鲲鹏', '618',
    'A8C0EA5B12F4', '865432041987654', '光和', '移动', '898600A3192301234567', '898604A8192301234568', '网络正常'
),
(
    'GD-20250905-017', '李四', '海底捞（五角场店）', '海底捞火锅', '杨浦区淞沪路77号5F', '值班店长', '13701663003',
    '2025-09-05', '弱电间在厨房后侧', '已安装', '马超', '华为', 'HUAWEI',
    'D4F5E6071829', '860123456789012', '电信', '电信', '89860323451234567890', '', '已加备用4G'
),
(
    'GD-20250820-012', '李四', '全家便利店（世纪大道）', '全家便利店', '浦东新区世纪大道1192号', '刘店长', '13611774004',
    '2025-08-20', '', '已安装', '赵云', '云软', 'Y618',
    '00E04C360A91', '861234567890123', '联通', '联通', '89860123456789012345', '89860923456789012346', ''
),
(
    'GD-20250712-009', '王五', '沙县小吃（张江高科）', '沙县小吃', '浦东新区张江路88号', '陈老板', '13564225005',
    '2025-07-12', '门头安装', '已安装', '黄忠', '鲲鹏', '618',
    'B827EB5A3C01', '', '移动', '移动', '89861118765432109876', '', '单卡'
),
(
    'GD-20250628-006', '王五', '肯德基（虹桥枢纽）', '百胜餐饮', '闵行区申虹路虹桥枢纽出发层', '区域工程', '13482336006',
    '2025-06-28', '需夜间施工', '已安装', '马超', '华为', 'HUAWEI',
    'F0B4297C8D2E', '869876543210987', '移动', '移动', '898600B51987654321098', '898604B51987654321099', '双卡热备'
),
(
    'GD-20250515-003', '赵六', '瑞幸咖啡（陆家嘴店）', '瑞幸咖啡', '浦东新区陆家嘴环路1000号', '店经理', '13321947007',
    '2025-05-15', '', '已安装', '赵云', '华为', 'HUAWEI',
    '4HB7S24C26110882', '865432041234567', '光和', '电信', '89860319112233445566', '', ''
),
(
    'GD-20250402-001', '赵六', '星巴克（徐家汇店）', '星巴克', '徐汇区虹桥路1号港汇恒隆', '值班主管', '13211858008',
    '2025-04-02', '企业宽带10M升100M', '已安装', '赵云', '鲲鹏', 'K618',
    'ACDE48273615', '864567890123456', '移动', '移动', '89861123209988776655', '89860487159988776656', '已测速达标'
),
(
    'GD-20260310-045', '张三', '老四川火锅（人民路）', '餐饮连锁A', '黄浦区人民路88号2F', '张老板', '13101769009',
    '2026-03-10', '', '已派工', '赵云', '', '',
    '', '', '', '', '', '', ''
),
(
    'GD-20260312-048', '李四', '稻状元（张江店）', '稻状元', '浦东新区科苑路399号', '周总', '13091670010',
    '2026-03-12', '待上门', '安装中', '马超', '华为', 'HUAWEI',
    'AA:BB:CC:DD:EE:02', '865432041234568', '', '电信', '', '', '弱电施工中'
);

-- 验证查询示例
-- SELECT store_name, customer_name, install_date, device_model, mac, imei, iccid, backup_iccid
-- FROM work_orders WHERE status = '已安装' AND store_name LIKE '%咖啡%';
--
-- SELECT * FROM work_orders WHERE mac ILIKE '%4HB7S24C26000931%';
-- SELECT * FROM work_orders WHERE iccid LIKE '%8986112320403848756%' OR backup_iccid LIKE '%8986112320403848756%';
