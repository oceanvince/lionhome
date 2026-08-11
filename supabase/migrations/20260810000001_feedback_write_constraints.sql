-- ---------------------------------------------------------------------
-- project_data_feedback 写入收紧
--
-- 原策略是 `with check (true)`，注释写的是「带应用层限流」——但那道限流当时
-- 并不存在，而且即便存在也拦不住这条路径：anon key 是公开的，任何人都可以
-- 直连 PostgREST 插入，完全绕过 /api/v1/condo/feedback 里 zod 的
-- note ≤ 2000 / contact ≤ 120 限制，无上限灌入自由文本和联系方式（PII）。
--
-- 应用层限流已补（lib/utils/rate-limit.ts），但它只在我们自己的路由上生效，
-- 所以长度和取值约束必须下沉到数据库，才对所有路径成立。
--
-- 约束用 NOT VALID 添加：只对新写入生效，不校验历史行，避免线上已有数据
-- 导致迁移失败。历史行确认干净后可以再 VALIDATE CONSTRAINT。
-- ---------------------------------------------------------------------

alter table project_data_feedback
  add constraint project_data_feedback_note_len
    check (char_length(user_note) between 2 and 2000) not valid;

alter table project_data_feedback
  add constraint project_data_feedback_contact_len
    check (contact is null or char_length(contact) <= 120) not valid;

alter table project_data_feedback
  add constraint project_data_feedback_dimension_valid
    check (dimension is null or dimension in ('profit', 'location', 'exit', 'rental')) not valid;

alter table project_data_feedback
  add constraint project_data_feedback_status_valid
    check (status in ('open', 'reviewing', 'resolved', 'rejected')) not valid;

-- 提交者只能创建 status='open' 的记录，不能自己插一条「已解决」把纠错淹掉。
-- status 有默认值 'open'，WITH CHECK 在默认值填充之后求值，所以正常提交
-- （不带 status 字段）依然通过。
drop policy if exists project_data_feedback_anon_insert on project_data_feedback;
drop policy if exists project_data_feedback_auth_insert on project_data_feedback;

create policy project_data_feedback_anon_insert on project_data_feedback
  for insert to anon with check (status = 'open');

create policy project_data_feedback_auth_insert on project_data_feedback
  for insert to authenticated with check (status = 'open');
