// 两个积分报表共用的已结算记录来源。
// points 是发积分事务保存的原始发放量，不读取兑换后会扣减的 user/points_group_user 余额，
// 也不按当前比例重新计算历史积分。搬表期间按 (Id, statistics_date) 去重。
const columns = [
    'Id', 'statistics_date', 'group_nickname', 'userId', 'userName',
    'z', 'x', 'yl', 'z_yl', 'x_yl', 'zd_yl', 'xd_yl', 'h_yl',
    'l_yl', 'k_yl', 'm_yl', 'q_yl', 'xml_zx', 'xml_sb', 'yxxz', 'points'
].map(column => `src.${column}`).join(', ');

module.exports = `(
    SELECT ${columns}
    FROM gameshist_record src
    WHERE src.closed = 1

    UNION ALL

    SELECT ${columns}
    FROM gameshist src
    WHERE src.closed = 1
      AND NOT EXISTS (
          SELECT 1 FROM gameshist_record archived
          WHERE archived.Id = src.Id
            AND archived.statistics_date = src.statistics_date
            AND archived.closed = 1
      )
)`;
