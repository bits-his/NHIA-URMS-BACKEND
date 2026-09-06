-- =============================================================================
-- SERVICOM SEED DATA — 30 Satisfaction Surveys + 30 Charter Performance Cards
--                 + 30 Complaints
-- Idempotent: deletes previous SEED-BATCH-30 rows by reference / complaint number
--
-- Prerequisites: zonal_offices + state_offices already seeded
-- Run: mysql -u USER -p nhia_db < src/scripts/seedServicomSurveyComplaintCharter.sql
-- =============================================================================

USE nhia_db;

-- ── Resolve zone/state IDs by description (portable across environments) ─────
SET @st_lag   = (SELECT id FROM state_offices WHERE description LIKE '%Lagos%'  ORDER BY id LIMIT 1);
SET @zn_lag   = (SELECT zonal_id FROM state_offices WHERE id = @st_lag);
SET @st_kan   = (SELECT id FROM state_offices WHERE description LIKE '%Kano%'   ORDER BY id LIMIT 1);
SET @zn_kan   = (SELECT zonal_id FROM state_offices WHERE id = @st_kan);
SET @st_fct   = (SELECT id FROM state_offices WHERE description LIKE '%FCT%' OR description LIKE '%Abuja%' ORDER BY id LIMIT 1);
SET @zn_fct   = (SELECT zonal_id FROM state_offices WHERE id = @st_fct);
SET @st_riv   = (SELECT id FROM state_offices WHERE description LIKE '%Rivers%' ORDER BY id LIMIT 1);
SET @zn_riv   = (SELECT zonal_id FROM state_offices WHERE id = @st_riv);
SET @st_kad   = (SELECT id FROM state_offices WHERE description LIKE '%Kaduna%' ORDER BY id LIMIT 1);
SET @zn_kad   = (SELECT zonal_id FROM state_offices WHERE id = @st_kad);
SET @st_imo   = (SELECT id FROM state_offices WHERE description LIKE '%Imo%'    ORDER BY id LIMIT 1);
SET @zn_imo   = (SELECT zonal_id FROM state_offices WHERE id = @st_imo);
SET @st_ond   = (SELECT id FROM state_offices WHERE description LIKE '%Ondo%'   ORDER BY id LIMIT 1);
SET @zn_ond   = (SELECT zonal_id FROM state_offices WHERE id = @st_ond);
SET @st_ben   = (SELECT id FROM state_offices WHERE description LIKE '%Benue%'  ORDER BY id LIMIT 1);
SET @zn_ben   = (SELECT zonal_id FROM state_offices WHERE id = @st_ben);
SET @st_oyo   = (SELECT id FROM state_offices WHERE description LIKE '%Oyo%'    ORDER BY id LIMIT 1);
SET @zn_oyo   = (SELECT zonal_id FROM state_offices WHERE id = @st_oyo);
SET @st_enugu = (SELECT id FROM state_offices WHERE description LIKE '%Enugu%'  ORDER BY id LIMIT 1);
SET @zn_enugu = (SELECT zonal_id FROM state_offices WHERE id = @st_enugu);

-- Fallback: if any state is missing, use first available state/zone
SET @st_any = (SELECT id FROM state_offices ORDER BY id LIMIT 1);
SET @zn_any = (SELECT zonal_id FROM state_offices WHERE id = @st_any);

SET @st_lag   = COALESCE(@st_lag, @st_any);   SET @zn_lag   = COALESCE(@zn_lag, @zn_any);
SET @st_kan   = COALESCE(@st_kan, @st_any);   SET @zn_kan   = COALESCE(@zn_kan, @zn_any);
SET @st_fct   = COALESCE(@st_fct, @st_any);   SET @zn_fct   = COALESCE(@zn_fct, @zn_any);
SET @st_riv   = COALESCE(@st_riv, @st_any);   SET @zn_riv   = COALESCE(@zn_riv, @zn_any);
SET @st_kad   = COALESCE(@st_kad, @st_any);   SET @zn_kad   = COALESCE(@zn_kad, @zn_any);
SET @st_imo   = COALESCE(@st_imo, @st_any);   SET @zn_imo   = COALESCE(@zn_imo, @zn_any);
SET @st_ond   = COALESCE(@st_ond, @st_any);   SET @zn_ond   = COALESCE(@zn_ond, @zn_any);
SET @st_ben   = COALESCE(@st_ben, @st_any);   SET @zn_ben   = COALESCE(@zn_ben, @zn_any);
SET @st_oyo   = COALESCE(@st_oyo, @st_any);   SET @zn_oyo   = COALESCE(@zn_oyo, @zn_any);
SET @st_enugu = COALESCE(@st_enugu, @st_any); SET @zn_enugu = COALESCE(@zn_enugu, @zn_any);

-- ── Clean previous batch ─────────────────────────────────────────────────────
DELETE FROM servicom_satisfaction_surveys
WHERE reference_id LIKE 'SAT-SEED-%';

DELETE FROM servicom_comment_cards
WHERE reference_id LIKE 'CCC-SEED-%';

DELETE FROM servicom_complaints
WHERE complaint_number LIKE 'CMP-SEED-%';


-- =============================================================================
-- 1) CUSTOMER SATISFACTION SURVEYS (30)
-- =============================================================================

INSERT INTO servicom_satisfaction_surveys (
  reference_id, zone_id, state_id, provider_name, survey_date,
  survey_officers, team, responses, total_score, max_score, percentage_score,
  created_by, created_at, updated_at
) VALUES

('SAT-SEED-001', @zn_lag, @st_lag, 'Lagos University Teaching Hospital', '2026-01-05',
 'Mrs. Ada Okafor', 'Zone A SERVICOM', '[{"question_id":"Q01","category":"SERVICE DELIVERY","question":"Are there physical or bureaucratic obstacles to access?","response":"no","score":0},{"question_id":"Q02","category":"SERVICE DELIVERY","question":"Is the facility open for NHIS enrollees only during working hours?","response":"yes","score":1},{"question_id":"Q03","category":"SERVICE DELIVERY","question":"Does the HCF recognise poor performance?","response":"yes","score":1},{"question_id":"Q04","category":"SERVICE DELIVERY","question":"Does the HCF give honest explanation of the reasons for poor performance?","response":"yes","score":1},{"question_id":"Q05","category":"SERVICE DELIVERY","question":"Does the HCF take remedial action for poor performance?","response":"no","score":0},{"question_id":"Q06","category":"TIMELINESS","question":"Are staff seen and perceived to provide prompt service?","response":"no","score":0},{"question_id":"Q07","category":"TIMELINESS","question":"Is there any system in place to monitor waiting time?","response":"no","score":0},{"question_id":"Q08","category":"TIMELINESS","question":"Is there reasonable explanation for delays that are not a regular occurrence?","response":"yes","score":1},{"question_id":"Q09","category":"TIMELINESS","question":"Are customers told of any unforeseen interruptions to service?","response":"yes","score":1},{"question_id":"Q10","category":"INFORMATION","question":"Does the healthcare facility publish the NHIS drug list?","response":"yes","score":1},{"question_id":"Q11","category":"INFORMATION","question":"Does the HCF give enrollees sufficient information with respect to referrals?","response":"yes","score":1},{"question_id":"Q12","category":"PROFESSIONALISM","question":"Are appointment procedures clearly detailed at all service points for enrollees to see?","response":"no","score":0},{"question_id":"Q13","category":"PROFESSIONALISM","question":"Are staff courteous and professional in their dealings with enrollees?","response":"yes","score":1}]', 8, 13, 61.5,
 'SERVICOM Seed Batch', NOW(), NOW()),

('SAT-SEED-002', @zn_kan, @st_kan, 'General Hospital Ikeja', '2026-01-08',
 'Mr. Ibrahim Musa', 'Zone B SERVICOM', '[{"question_id":"Q01","category":"SERVICE DELIVERY","question":"Are there physical or bureaucratic obstacles to access?","response":"yes","score":1},{"question_id":"Q02","category":"SERVICE DELIVERY","question":"Is the facility open for NHIS enrollees only during working hours?","response":"no","score":0},{"question_id":"Q03","category":"SERVICE DELIVERY","question":"Does the HCF recognise poor performance?","response":"no","score":0},{"question_id":"Q04","category":"SERVICE DELIVERY","question":"Does the HCF give honest explanation of the reasons for poor performance?","response":"yes","score":1},{"question_id":"Q05","category":"SERVICE DELIVERY","question":"Does the HCF take remedial action for poor performance?","response":"no","score":0},{"question_id":"Q06","category":"TIMELINESS","question":"Are staff seen and perceived to provide prompt service?","response":"no","score":0},{"question_id":"Q07","category":"TIMELINESS","question":"Is there any system in place to monitor waiting time?","response":"yes","score":1},{"question_id":"Q08","category":"TIMELINESS","question":"Is there reasonable explanation for delays that are not a regular occurrence?","response":"no","score":0},{"question_id":"Q09","category":"TIMELINESS","question":"Are customers told of any unforeseen interruptions to service?","response":"no","score":0},{"question_id":"Q10","category":"INFORMATION","question":"Does the healthcare facility publish the NHIS drug list?","response":"yes","score":1},{"question_id":"Q11","category":"INFORMATION","question":"Does the HCF give enrollees sufficient information with respect to referrals?","response":"yes","score":1},{"question_id":"Q12","category":"PROFESSIONALISM","question":"Are appointment procedures clearly detailed at all service points for enrollees to see?","response":"no","score":0},{"question_id":"Q13","category":"PROFESSIONALISM","question":"Are staff courteous and professional in their dealings with enrollees?","response":"yes","score":1}]', 6, 13, 46.2,
 'SERVICOM Seed Batch', NOW(), NOW()),

('SAT-SEED-003', @zn_fct, @st_fct, 'National Hospital Abuja', '2026-01-11',
 'Mrs. Grace Etim', 'HQ Monitoring Team', '[{"question_id":"Q01","category":"SERVICE DELIVERY","question":"Are there physical or bureaucratic obstacles to access?","response":"yes","score":1},{"question_id":"Q02","category":"SERVICE DELIVERY","question":"Is the facility open for NHIS enrollees only during working hours?","response":"yes","score":1},{"question_id":"Q03","category":"SERVICE DELIVERY","question":"Does the HCF recognise poor performance?","response":"no","score":0},{"question_id":"Q04","category":"SERVICE DELIVERY","question":"Does the HCF give honest explanation of the reasons for poor performance?","response":"no","score":0},{"question_id":"Q05","category":"SERVICE DELIVERY","question":"Does the HCF take remedial action for poor performance?","response":"no","score":0},{"question_id":"Q06","category":"TIMELINESS","question":"Are staff seen and perceived to provide prompt service?","response":"no","score":0},{"question_id":"Q07","category":"TIMELINESS","question":"Is there any system in place to monitor waiting time?","response":"yes","score":1},{"question_id":"Q08","category":"TIMELINESS","question":"Is there reasonable explanation for delays that are not a regular occurrence?","response":"no","score":0},{"question_id":"Q09","category":"TIMELINESS","question":"Are customers told of any unforeseen interruptions to service?","response":"yes","score":1},{"question_id":"Q10","category":"INFORMATION","question":"Does the healthcare facility publish the NHIS drug list?","response":"no","score":0},{"question_id":"Q11","category":"INFORMATION","question":"Does the HCF give enrollees sufficient information with respect to referrals?","response":"no","score":0},{"question_id":"Q12","category":"PROFESSIONALISM","question":"Are appointment procedures clearly detailed at all service points for enrollees to see?","response":"no","score":0},{"question_id":"Q13","category":"PROFESSIONALISM","question":"Are staff courteous and professional in their dealings with enrollees?","response":"no","score":0}]', 4, 13, 30.8,
 'SERVICOM Seed Batch', NOW(), NOW()),

('SAT-SEED-004', @zn_riv, @st_riv, 'Aminu Kano Teaching Hospital', '2026-01-14',
 'Mr. Chinedu Okeke', 'State Desk Team', '[{"question_id":"Q01","category":"SERVICE DELIVERY","question":"Are there physical or bureaucratic obstacles to access?","response":"yes","score":1},{"question_id":"Q02","category":"SERVICE DELIVERY","question":"Is the facility open for NHIS enrollees only during working hours?","response":"no","score":0},{"question_id":"Q03","category":"SERVICE DELIVERY","question":"Does the HCF recognise poor performance?","response":"yes","score":1},{"question_id":"Q04","category":"SERVICE DELIVERY","question":"Does the HCF give honest explanation of the reasons for poor performance?","response":"yes","score":1},{"question_id":"Q05","category":"SERVICE DELIVERY","question":"Does the HCF take remedial action for poor performance?","response":"yes","score":1},{"question_id":"Q06","category":"TIMELINESS","question":"Are staff seen and perceived to provide prompt service?","response":"yes","score":1},{"question_id":"Q07","category":"TIMELINESS","question":"Is there any system in place to monitor waiting time?","response":"yes","score":1},{"question_id":"Q08","category":"TIMELINESS","question":"Is there reasonable explanation for delays that are not a regular occurrence?","response":"yes","score":1},{"question_id":"Q09","category":"TIMELINESS","question":"Are customers told of any unforeseen interruptions to service?","response":"yes","score":1},{"question_id":"Q10","category":"INFORMATION","question":"Does the healthcare facility publish the NHIS drug list?","response":"no","score":0},{"question_id":"Q11","category":"INFORMATION","question":"Does the HCF give enrollees sufficient information with respect to referrals?","response":"yes","score":1},{"question_id":"Q12","category":"PROFESSIONALISM","question":"Are appointment procedures clearly detailed at all service points for enrollees to see?","response":"yes","score":1},{"question_id":"Q13","category":"PROFESSIONALISM","question":"Are staff courteous and professional in their dealings with enrollees?","response":"yes","score":1}]', 11, 13, 84.6,
 'SERVICOM Seed Batch', NOW(), NOW()),

('SAT-SEED-005', @zn_kad, @st_kad, 'University of Port Harcourt Teaching Hospital', '2026-01-17',
 'Mrs. Fatima Bello', 'Field Assessment Unit', '[{"question_id":"Q01","category":"SERVICE DELIVERY","question":"Are there physical or bureaucratic obstacles to access?","response":"yes","score":1},{"question_id":"Q02","category":"SERVICE DELIVERY","question":"Is the facility open for NHIS enrollees only during working hours?","response":"no","score":0},{"question_id":"Q03","category":"SERVICE DELIVERY","question":"Does the HCF recognise poor performance?","response":"yes","score":1},{"question_id":"Q04","category":"SERVICE DELIVERY","question":"Does the HCF give honest explanation of the reasons for poor performance?","response":"yes","score":1},{"question_id":"Q05","category":"SERVICE DELIVERY","question":"Does the HCF take remedial action for poor performance?","response":"yes","score":1},{"question_id":"Q06","category":"TIMELINESS","question":"Are staff seen and perceived to provide prompt service?","response":"no","score":0},{"question_id":"Q07","category":"TIMELINESS","question":"Is there any system in place to monitor waiting time?","response":"yes","score":1},{"question_id":"Q08","category":"TIMELINESS","question":"Is there reasonable explanation for delays that are not a regular occurrence?","response":"yes","score":1},{"question_id":"Q09","category":"TIMELINESS","question":"Are customers told of any unforeseen interruptions to service?","response":"no","score":0},{"question_id":"Q10","category":"INFORMATION","question":"Does the healthcare facility publish the NHIS drug list?","response":"yes","score":1},{"question_id":"Q11","category":"INFORMATION","question":"Does the HCF give enrollees sufficient information with respect to referrals?","response":"yes","score":1},{"question_id":"Q12","category":"PROFESSIONALISM","question":"Are appointment procedures clearly detailed at all service points for enrollees to see?","response":"no","score":0},{"question_id":"Q13","category":"PROFESSIONALISM","question":"Are staff courteous and professional in their dealings with enrollees?","response":"no","score":0}]', 8, 13, 61.5,
 'SERVICOM Seed Batch', NOW(), NOW()),

('SAT-SEED-006', @zn_imo, @st_imo, 'Ahmadu Bello University Teaching Hospital', '2026-01-20',
 'Mr. Tunde Adebayo', 'Zone A SERVICOM', '[{"question_id":"Q01","category":"SERVICE DELIVERY","question":"Are there physical or bureaucratic obstacles to access?","response":"no","score":0},{"question_id":"Q02","category":"SERVICE DELIVERY","question":"Is the facility open for NHIS enrollees only during working hours?","response":"yes","score":1},{"question_id":"Q03","category":"SERVICE DELIVERY","question":"Does the HCF recognise poor performance?","response":"yes","score":1},{"question_id":"Q04","category":"SERVICE DELIVERY","question":"Does the HCF give honest explanation of the reasons for poor performance?","response":"yes","score":1},{"question_id":"Q05","category":"SERVICE DELIVERY","question":"Does the HCF take remedial action for poor performance?","response":"yes","score":1},{"question_id":"Q06","category":"TIMELINESS","question":"Are staff seen and perceived to provide prompt service?","response":"yes","score":1},{"question_id":"Q07","category":"TIMELINESS","question":"Is there any system in place to monitor waiting time?","response":"no","score":0},{"question_id":"Q08","category":"TIMELINESS","question":"Is there reasonable explanation for delays that are not a regular occurrence?","response":"no","score":0},{"question_id":"Q09","category":"TIMELINESS","question":"Are customers told of any unforeseen interruptions to service?","response":"yes","score":1},{"question_id":"Q10","category":"INFORMATION","question":"Does the healthcare facility publish the NHIS drug list?","response":"yes","score":1},{"question_id":"Q11","category":"INFORMATION","question":"Does the HCF give enrollees sufficient information with respect to referrals?","response":"yes","score":1},{"question_id":"Q12","category":"PROFESSIONALISM","question":"Are appointment procedures clearly detailed at all service points for enrollees to see?","response":"no","score":0},{"question_id":"Q13","category":"PROFESSIONALISM","question":"Are staff courteous and professional in their dealings with enrollees?","response":"yes","score":1}]', 9, 13, 69.2,
 'SERVICOM Seed Batch', NOW(), NOW()),

('SAT-SEED-007', @zn_ond, @st_ond, 'Federal Medical Centre Owerri', '2026-01-23',
 'Mrs. Ngozi Eze', 'Zone B SERVICOM', '[{"question_id":"Q01","category":"SERVICE DELIVERY","question":"Are there physical or bureaucratic obstacles to access?","response":"yes","score":1},{"question_id":"Q02","category":"SERVICE DELIVERY","question":"Is the facility open for NHIS enrollees only during working hours?","response":"yes","score":1},{"question_id":"Q03","category":"SERVICE DELIVERY","question":"Does the HCF recognise poor performance?","response":"yes","score":1},{"question_id":"Q04","category":"SERVICE DELIVERY","question":"Does the HCF give honest explanation of the reasons for poor performance?","response":"yes","score":1},{"question_id":"Q05","category":"SERVICE DELIVERY","question":"Does the HCF take remedial action for poor performance?","response":"yes","score":1},{"question_id":"Q06","category":"TIMELINESS","question":"Are staff seen and perceived to provide prompt service?","response":"no","score":0},{"question_id":"Q07","category":"TIMELINESS","question":"Is there any system in place to monitor waiting time?","response":"yes","score":1},{"question_id":"Q08","category":"TIMELINESS","question":"Is there reasonable explanation for delays that are not a regular occurrence?","response":"yes","score":1},{"question_id":"Q09","category":"TIMELINESS","question":"Are customers told of any unforeseen interruptions to service?","response":"no","score":0},{"question_id":"Q10","category":"INFORMATION","question":"Does the healthcare facility publish the NHIS drug list?","response":"yes","score":1},{"question_id":"Q11","category":"INFORMATION","question":"Does the HCF give enrollees sufficient information with respect to referrals?","response":"yes","score":1},{"question_id":"Q12","category":"PROFESSIONALISM","question":"Are appointment procedures clearly detailed at all service points for enrollees to see?","response":"yes","score":1},{"question_id":"Q13","category":"PROFESSIONALISM","question":"Are staff courteous and professional in their dealings with enrollees?","response":"yes","score":1}]', 11, 13, 84.6,
 'SERVICOM Seed Batch', NOW(), NOW()),

('SAT-SEED-008', @zn_ben, @st_ben, 'Federal Medical Centre Lokoja', '2026-01-26',
 'Mr. Yusuf Aliyu', 'HQ Monitoring Team', '[{"question_id":"Q01","category":"SERVICE DELIVERY","question":"Are there physical or bureaucratic obstacles to access?","response":"yes","score":1},{"question_id":"Q02","category":"SERVICE DELIVERY","question":"Is the facility open for NHIS enrollees only during working hours?","response":"yes","score":1},{"question_id":"Q03","category":"SERVICE DELIVERY","question":"Does the HCF recognise poor performance?","response":"yes","score":1},{"question_id":"Q04","category":"SERVICE DELIVERY","question":"Does the HCF give honest explanation of the reasons for poor performance?","response":"yes","score":1},{"question_id":"Q05","category":"SERVICE DELIVERY","question":"Does the HCF take remedial action for poor performance?","response":"yes","score":1},{"question_id":"Q06","category":"TIMELINESS","question":"Are staff seen and perceived to provide prompt service?","response":"no","score":0},{"question_id":"Q07","category":"TIMELINESS","question":"Is there any system in place to monitor waiting time?","response":"yes","score":1},{"question_id":"Q08","category":"TIMELINESS","question":"Is there reasonable explanation for delays that are not a regular occurrence?","response":"no","score":0},{"question_id":"Q09","category":"TIMELINESS","question":"Are customers told of any unforeseen interruptions to service?","response":"no","score":0},{"question_id":"Q10","category":"INFORMATION","question":"Does the healthcare facility publish the NHIS drug list?","response":"yes","score":1},{"question_id":"Q11","category":"INFORMATION","question":"Does the HCF give enrollees sufficient information with respect to referrals?","response":"yes","score":1},{"question_id":"Q12","category":"PROFESSIONALISM","question":"Are appointment procedures clearly detailed at all service points for enrollees to see?","response":"yes","score":1},{"question_id":"Q13","category":"PROFESSIONALISM","question":"Are staff courteous and professional in their dealings with enrollees?","response":"yes","score":1}]', 10, 13, 76.9,
 'SERVICOM Seed Batch', NOW(), NOW()),

('SAT-SEED-009', @zn_oyo, @st_oyo, 'Lagos State University Teaching Hospital', '2026-01-29',
 'Mrs. Blessing Okoro', 'State Desk Team', '[{"question_id":"Q01","category":"SERVICE DELIVERY","question":"Are there physical or bureaucratic obstacles to access?","response":"yes","score":1},{"question_id":"Q02","category":"SERVICE DELIVERY","question":"Is the facility open for NHIS enrollees only during working hours?","response":"yes","score":1},{"question_id":"Q03","category":"SERVICE DELIVERY","question":"Does the HCF recognise poor performance?","response":"yes","score":1},{"question_id":"Q04","category":"SERVICE DELIVERY","question":"Does the HCF give honest explanation of the reasons for poor performance?","response":"yes","score":1},{"question_id":"Q05","category":"SERVICE DELIVERY","question":"Does the HCF take remedial action for poor performance?","response":"yes","score":1},{"question_id":"Q06","category":"TIMELINESS","question":"Are staff seen and perceived to provide prompt service?","response":"no","score":0},{"question_id":"Q07","category":"TIMELINESS","question":"Is there any system in place to monitor waiting time?","response":"no","score":0},{"question_id":"Q08","category":"TIMELINESS","question":"Is there reasonable explanation for delays that are not a regular occurrence?","response":"yes","score":1},{"question_id":"Q09","category":"TIMELINESS","question":"Are customers told of any unforeseen interruptions to service?","response":"yes","score":1},{"question_id":"Q10","category":"INFORMATION","question":"Does the healthcare facility publish the NHIS drug list?","response":"yes","score":1},{"question_id":"Q11","category":"INFORMATION","question":"Does the HCF give enrollees sufficient information with respect to referrals?","response":"no","score":0},{"question_id":"Q12","category":"PROFESSIONALISM","question":"Are appointment procedures clearly detailed at all service points for enrollees to see?","response":"no","score":0},{"question_id":"Q13","category":"PROFESSIONALISM","question":"Are staff courteous and professional in their dealings with enrollees?","response":"yes","score":1}]', 9, 13, 69.2,
 'SERVICOM Seed Batch', NOW(), NOW()),

('SAT-SEED-010', @zn_enugu, @st_enugu, 'Gwarinpa General Hospital', '2026-02-01',
 'Mr. Ahmed Sani', 'Field Assessment Unit', '[{"question_id":"Q01","category":"SERVICE DELIVERY","question":"Are there physical or bureaucratic obstacles to access?","response":"yes","score":1},{"question_id":"Q02","category":"SERVICE DELIVERY","question":"Is the facility open for NHIS enrollees only during working hours?","response":"yes","score":1},{"question_id":"Q03","category":"SERVICE DELIVERY","question":"Does the HCF recognise poor performance?","response":"yes","score":1},{"question_id":"Q04","category":"SERVICE DELIVERY","question":"Does the HCF give honest explanation of the reasons for poor performance?","response":"yes","score":1},{"question_id":"Q05","category":"SERVICE DELIVERY","question":"Does the HCF take remedial action for poor performance?","response":"yes","score":1},{"question_id":"Q06","category":"TIMELINESS","question":"Are staff seen and perceived to provide prompt service?","response":"yes","score":1},{"question_id":"Q07","category":"TIMELINESS","question":"Is there any system in place to monitor waiting time?","response":"yes","score":1},{"question_id":"Q08","category":"TIMELINESS","question":"Is there reasonable explanation for delays that are not a regular occurrence?","response":"yes","score":1},{"question_id":"Q09","category":"TIMELINESS","question":"Are customers told of any unforeseen interruptions to service?","response":"yes","score":1},{"question_id":"Q10","category":"INFORMATION","question":"Does the healthcare facility publish the NHIS drug list?","response":"yes","score":1},{"question_id":"Q11","category":"INFORMATION","question":"Does the HCF give enrollees sufficient information with respect to referrals?","response":"no","score":0},{"question_id":"Q12","category":"PROFESSIONALISM","question":"Are appointment procedures clearly detailed at all service points for enrollees to see?","response":"yes","score":1},{"question_id":"Q13","category":"PROFESSIONALISM","question":"Are staff courteous and professional in their dealings with enrollees?","response":"yes","score":1}]', 12, 13, 92.3,
 'SERVICOM Seed Batch', NOW(), NOW()),

('SAT-SEED-011', @zn_lag, @st_lag, 'Murtala Muhammed Specialist Hospital', '2026-02-04',
 'Mrs. Ada Okafor', 'Zone A SERVICOM', '[{"question_id":"Q01","category":"SERVICE DELIVERY","question":"Are there physical or bureaucratic obstacles to access?","response":"yes","score":1},{"question_id":"Q02","category":"SERVICE DELIVERY","question":"Is the facility open for NHIS enrollees only during working hours?","response":"yes","score":1},{"question_id":"Q03","category":"SERVICE DELIVERY","question":"Does the HCF recognise poor performance?","response":"no","score":0},{"question_id":"Q04","category":"SERVICE DELIVERY","question":"Does the HCF give honest explanation of the reasons for poor performance?","response":"no","score":0},{"question_id":"Q05","category":"SERVICE DELIVERY","question":"Does the HCF take remedial action for poor performance?","response":"yes","score":1},{"question_id":"Q06","category":"TIMELINESS","question":"Are staff seen and perceived to provide prompt service?","response":"no","score":0},{"question_id":"Q07","category":"TIMELINESS","question":"Is there any system in place to monitor waiting time?","response":"yes","score":1},{"question_id":"Q08","category":"TIMELINESS","question":"Is there reasonable explanation for delays that are not a regular occurrence?","response":"no","score":0},{"question_id":"Q09","category":"TIMELINESS","question":"Are customers told of any unforeseen interruptions to service?","response":"no","score":0},{"question_id":"Q10","category":"INFORMATION","question":"Does the healthcare facility publish the NHIS drug list?","response":"yes","score":1},{"question_id":"Q11","category":"INFORMATION","question":"Does the HCF give enrollees sufficient information with respect to referrals?","response":"no","score":0},{"question_id":"Q12","category":"PROFESSIONALISM","question":"Are appointment procedures clearly detailed at all service points for enrollees to see?","response":"no","score":0},{"question_id":"Q13","category":"PROFESSIONALISM","question":"Are staff courteous and professional in their dealings with enrollees?","response":"yes","score":1}]', 6, 13, 46.2,
 'SERVICOM Seed Batch', NOW(), NOW()),

('SAT-SEED-012', @zn_kan, @st_kan, 'Braithwaite Memorial Specialist Hospital', '2026-02-07',
 'Mr. Ibrahim Musa', 'Zone B SERVICOM', '[{"question_id":"Q01","category":"SERVICE DELIVERY","question":"Are there physical or bureaucratic obstacles to access?","response":"no","score":0},{"question_id":"Q02","category":"SERVICE DELIVERY","question":"Is the facility open for NHIS enrollees only during working hours?","response":"yes","score":1},{"question_id":"Q03","category":"SERVICE DELIVERY","question":"Does the HCF recognise poor performance?","response":"yes","score":1},{"question_id":"Q04","category":"SERVICE DELIVERY","question":"Does the HCF give honest explanation of the reasons for poor performance?","response":"no","score":0},{"question_id":"Q05","category":"SERVICE DELIVERY","question":"Does the HCF take remedial action for poor performance?","response":"no","score":0},{"question_id":"Q06","category":"TIMELINESS","question":"Are staff seen and perceived to provide prompt service?","response":"yes","score":1},{"question_id":"Q07","category":"TIMELINESS","question":"Is there any system in place to monitor waiting time?","response":"yes","score":1},{"question_id":"Q08","category":"TIMELINESS","question":"Is there reasonable explanation for delays that are not a regular occurrence?","response":"no","score":0},{"question_id":"Q09","category":"TIMELINESS","question":"Are customers told of any unforeseen interruptions to service?","response":"no","score":0},{"question_id":"Q10","category":"INFORMATION","question":"Does the healthcare facility publish the NHIS drug list?","response":"yes","score":1},{"question_id":"Q11","category":"INFORMATION","question":"Does the HCF give enrollees sufficient information with respect to referrals?","response":"no","score":0},{"question_id":"Q12","category":"PROFESSIONALISM","question":"Are appointment procedures clearly detailed at all service points for enrollees to see?","response":"yes","score":1},{"question_id":"Q13","category":"PROFESSIONALISM","question":"Are staff courteous and professional in their dealings with enrollees?","response":"yes","score":1}]', 7, 13, 53.8,
 'SERVICOM Seed Batch', NOW(), NOW()),

('SAT-SEED-013', @zn_fct, @st_fct, 'Barau Dikko Teaching Hospital', '2026-02-10',
 'Mrs. Grace Etim', 'HQ Monitoring Team', '[{"question_id":"Q01","category":"SERVICE DELIVERY","question":"Are there physical or bureaucratic obstacles to access?","response":"yes","score":1},{"question_id":"Q02","category":"SERVICE DELIVERY","question":"Is the facility open for NHIS enrollees only during working hours?","response":"no","score":0},{"question_id":"Q03","category":"SERVICE DELIVERY","question":"Does the HCF recognise poor performance?","response":"yes","score":1},{"question_id":"Q04","category":"SERVICE DELIVERY","question":"Does the HCF give honest explanation of the reasons for poor performance?","response":"yes","score":1},{"question_id":"Q05","category":"SERVICE DELIVERY","question":"Does the HCF take remedial action for poor performance?","response":"yes","score":1},{"question_id":"Q06","category":"TIMELINESS","question":"Are staff seen and perceived to provide prompt service?","response":"no","score":0},{"question_id":"Q07","category":"TIMELINESS","question":"Is there any system in place to monitor waiting time?","response":"yes","score":1},{"question_id":"Q08","category":"TIMELINESS","question":"Is there reasonable explanation for delays that are not a regular occurrence?","response":"no","score":0},{"question_id":"Q09","category":"TIMELINESS","question":"Are customers told of any unforeseen interruptions to service?","response":"no","score":0},{"question_id":"Q10","category":"INFORMATION","question":"Does the healthcare facility publish the NHIS drug list?","response":"yes","score":1},{"question_id":"Q11","category":"INFORMATION","question":"Does the HCF give enrollees sufficient information with respect to referrals?","response":"yes","score":1},{"question_id":"Q12","category":"PROFESSIONALISM","question":"Are appointment procedures clearly detailed at all service points for enrollees to see?","response":"no","score":0},{"question_id":"Q13","category":"PROFESSIONALISM","question":"Are staff courteous and professional in their dealings with enrollees?","response":"yes","score":1}]', 8, 13, 61.5,
 'SERVICOM Seed Batch', NOW(), NOW()),

('SAT-SEED-014', @zn_riv, @st_riv, 'Imo State University Teaching Hospital', '2026-02-13',
 'Mr. Chinedu Okeke', 'State Desk Team', '[{"question_id":"Q01","category":"SERVICE DELIVERY","question":"Are there physical or bureaucratic obstacles to access?","response":"yes","score":1},{"question_id":"Q02","category":"SERVICE DELIVERY","question":"Is the facility open for NHIS enrollees only during working hours?","response":"no","score":0},{"question_id":"Q03","category":"SERVICE DELIVERY","question":"Does the HCF recognise poor performance?","response":"yes","score":1},{"question_id":"Q04","category":"SERVICE DELIVERY","question":"Does the HCF give honest explanation of the reasons for poor performance?","response":"yes","score":1},{"question_id":"Q05","category":"SERVICE DELIVERY","question":"Does the HCF take remedial action for poor performance?","response":"no","score":0},{"question_id":"Q06","category":"TIMELINESS","question":"Are staff seen and perceived to provide prompt service?","response":"no","score":0},{"question_id":"Q07","category":"TIMELINESS","question":"Is there any system in place to monitor waiting time?","response":"yes","score":1},{"question_id":"Q08","category":"TIMELINESS","question":"Is there reasonable explanation for delays that are not a regular occurrence?","response":"yes","score":1},{"question_id":"Q09","category":"TIMELINESS","question":"Are customers told of any unforeseen interruptions to service?","response":"yes","score":1},{"question_id":"Q10","category":"INFORMATION","question":"Does the healthcare facility publish the NHIS drug list?","response":"yes","score":1},{"question_id":"Q11","category":"INFORMATION","question":"Does the HCF give enrollees sufficient information with respect to referrals?","response":"yes","score":1},{"question_id":"Q12","category":"PROFESSIONALISM","question":"Are appointment procedures clearly detailed at all service points for enrollees to see?","response":"no","score":0},{"question_id":"Q13","category":"PROFESSIONALISM","question":"Are staff courteous and professional in their dealings with enrollees?","response":"no","score":0}]', 8, 13, 61.5,
 'SERVICOM Seed Batch', NOW(), NOW()),

('SAT-SEED-015', @zn_kad, @st_kad, 'Federal Medical Centre Asaba', '2026-02-16',
 'Mrs. Fatima Bello', 'Field Assessment Unit', '[{"question_id":"Q01","category":"SERVICE DELIVERY","question":"Are there physical or bureaucratic obstacles to access?","response":"no","score":0},{"question_id":"Q02","category":"SERVICE DELIVERY","question":"Is the facility open for NHIS enrollees only during working hours?","response":"yes","score":1},{"question_id":"Q03","category":"SERVICE DELIVERY","question":"Does the HCF recognise poor performance?","response":"yes","score":1},{"question_id":"Q04","category":"SERVICE DELIVERY","question":"Does the HCF give honest explanation of the reasons for poor performance?","response":"yes","score":1},{"question_id":"Q05","category":"SERVICE DELIVERY","question":"Does the HCF take remedial action for poor performance?","response":"no","score":0},{"question_id":"Q06","category":"TIMELINESS","question":"Are staff seen and perceived to provide prompt service?","response":"yes","score":1},{"question_id":"Q07","category":"TIMELINESS","question":"Is there any system in place to monitor waiting time?","response":"yes","score":1},{"question_id":"Q08","category":"TIMELINESS","question":"Is there reasonable explanation for delays that are not a regular occurrence?","response":"yes","score":1},{"question_id":"Q09","category":"TIMELINESS","question":"Are customers told of any unforeseen interruptions to service?","response":"yes","score":1},{"question_id":"Q10","category":"INFORMATION","question":"Does the healthcare facility publish the NHIS drug list?","response":"yes","score":1},{"question_id":"Q11","category":"INFORMATION","question":"Does the HCF give enrollees sufficient information with respect to referrals?","response":"yes","score":1},{"question_id":"Q12","category":"PROFESSIONALISM","question":"Are appointment procedures clearly detailed at all service points for enrollees to see?","response":"no","score":0},{"question_id":"Q13","category":"PROFESSIONALISM","question":"Are staff courteous and professional in their dealings with enrollees?","response":"yes","score":1}]', 10, 13, 76.9,
 'SERVICOM Seed Batch', NOW(), NOW()),

('SAT-SEED-016', @zn_imo, @st_imo, 'University of Nigeria Teaching Hospital', '2026-02-19',
 'Mr. Tunde Adebayo', 'Zone A SERVICOM', '[{"question_id":"Q01","category":"SERVICE DELIVERY","question":"Are there physical or bureaucratic obstacles to access?","response":"no","score":0},{"question_id":"Q02","category":"SERVICE DELIVERY","question":"Is the facility open for NHIS enrollees only during working hours?","response":"yes","score":1},{"question_id":"Q03","category":"SERVICE DELIVERY","question":"Does the HCF recognise poor performance?","response":"yes","score":1},{"question_id":"Q04","category":"SERVICE DELIVERY","question":"Does the HCF give honest explanation of the reasons for poor performance?","response":"no","score":0},{"question_id":"Q05","category":"SERVICE DELIVERY","question":"Does the HCF take remedial action for poor performance?","response":"no","score":0},{"question_id":"Q06","category":"TIMELINESS","question":"Are staff seen and perceived to provide prompt service?","response":"no","score":0},{"question_id":"Q07","category":"TIMELINESS","question":"Is there any system in place to monitor waiting time?","response":"no","score":0},{"question_id":"Q08","category":"TIMELINESS","question":"Is there reasonable explanation for delays that are not a regular occurrence?","response":"no","score":0},{"question_id":"Q09","category":"TIMELINESS","question":"Are customers told of any unforeseen interruptions to service?","response":"yes","score":1},{"question_id":"Q10","category":"INFORMATION","question":"Does the healthcare facility publish the NHIS drug list?","response":"yes","score":1},{"question_id":"Q11","category":"INFORMATION","question":"Does the HCF give enrollees sufficient information with respect to referrals?","response":"yes","score":1},{"question_id":"Q12","category":"PROFESSIONALISM","question":"Are appointment procedures clearly detailed at all service points for enrollees to see?","response":"yes","score":1},{"question_id":"Q13","category":"PROFESSIONALISM","question":"Are staff courteous and professional in their dealings with enrollees?","response":"yes","score":1}]', 7, 13, 53.8,
 'SERVICOM Seed Batch', NOW(), NOW()),

('SAT-SEED-017', @zn_ond, @st_ond, 'Jos University Teaching Hospital', '2026-02-22',
 'Mrs. Ngozi Eze', 'Zone B SERVICOM', '[{"question_id":"Q01","category":"SERVICE DELIVERY","question":"Are there physical or bureaucratic obstacles to access?","response":"yes","score":1},{"question_id":"Q02","category":"SERVICE DELIVERY","question":"Is the facility open for NHIS enrollees only during working hours?","response":"no","score":0},{"question_id":"Q03","category":"SERVICE DELIVERY","question":"Does the HCF recognise poor performance?","response":"yes","score":1},{"question_id":"Q04","category":"SERVICE DELIVERY","question":"Does the HCF give honest explanation of the reasons for poor performance?","response":"no","score":0},{"question_id":"Q05","category":"SERVICE DELIVERY","question":"Does the HCF take remedial action for poor performance?","response":"yes","score":1},{"question_id":"Q06","category":"TIMELINESS","question":"Are staff seen and perceived to provide prompt service?","response":"yes","score":1},{"question_id":"Q07","category":"TIMELINESS","question":"Is there any system in place to monitor waiting time?","response":"no","score":0},{"question_id":"Q08","category":"TIMELINESS","question":"Is there reasonable explanation for delays that are not a regular occurrence?","response":"no","score":0},{"question_id":"Q09","category":"TIMELINESS","question":"Are customers told of any unforeseen interruptions to service?","response":"yes","score":1},{"question_id":"Q10","category":"INFORMATION","question":"Does the healthcare facility publish the NHIS drug list?","response":"yes","score":1},{"question_id":"Q11","category":"INFORMATION","question":"Does the HCF give enrollees sufficient information with respect to referrals?","response":"yes","score":1},{"question_id":"Q12","category":"PROFESSIONALISM","question":"Are appointment procedures clearly detailed at all service points for enrollees to see?","response":"yes","score":1},{"question_id":"Q13","category":"PROFESSIONALISM","question":"Are staff courteous and professional in their dealings with enrollees?","response":"no","score":0}]', 8, 13, 61.5,
 'SERVICOM Seed Batch', NOW(), NOW()),

('SAT-SEED-018', @zn_ben, @st_ben, 'University of Ilorin Teaching Hospital', '2026-02-25',
 'Mr. Yusuf Aliyu', 'HQ Monitoring Team', '[{"question_id":"Q01","category":"SERVICE DELIVERY","question":"Are there physical or bureaucratic obstacles to access?","response":"yes","score":1},{"question_id":"Q02","category":"SERVICE DELIVERY","question":"Is the facility open for NHIS enrollees only during working hours?","response":"yes","score":1},{"question_id":"Q03","category":"SERVICE DELIVERY","question":"Does the HCF recognise poor performance?","response":"yes","score":1},{"question_id":"Q04","category":"SERVICE DELIVERY","question":"Does the HCF give honest explanation of the reasons for poor performance?","response":"yes","score":1},{"question_id":"Q05","category":"SERVICE DELIVERY","question":"Does the HCF take remedial action for poor performance?","response":"yes","score":1},{"question_id":"Q06","category":"TIMELINESS","question":"Are staff seen and perceived to provide prompt service?","response":"yes","score":1},{"question_id":"Q07","category":"TIMELINESS","question":"Is there any system in place to monitor waiting time?","response":"no","score":0},{"question_id":"Q08","category":"TIMELINESS","question":"Is there reasonable explanation for delays that are not a regular occurrence?","response":"yes","score":1},{"question_id":"Q09","category":"TIMELINESS","question":"Are customers told of any unforeseen interruptions to service?","response":"no","score":0},{"question_id":"Q10","category":"INFORMATION","question":"Does the healthcare facility publish the NHIS drug list?","response":"yes","score":1},{"question_id":"Q11","category":"INFORMATION","question":"Does the HCF give enrollees sufficient information with respect to referrals?","response":"yes","score":1},{"question_id":"Q12","category":"PROFESSIONALISM","question":"Are appointment procedures clearly detailed at all service points for enrollees to see?","response":"yes","score":1},{"question_id":"Q13","category":"PROFESSIONALISM","question":"Are staff courteous and professional in their dealings with enrollees?","response":"yes","score":1}]', 11, 13, 84.6,
 'SERVICOM Seed Batch', NOW(), NOW()),

('SAT-SEED-019', @zn_oyo, @st_oyo, 'Federal Medical Centre Abeokuta', '2026-02-28',
 'Mrs. Blessing Okoro', 'State Desk Team', '[{"question_id":"Q01","category":"SERVICE DELIVERY","question":"Are there physical or bureaucratic obstacles to access?","response":"yes","score":1},{"question_id":"Q02","category":"SERVICE DELIVERY","question":"Is the facility open for NHIS enrollees only during working hours?","response":"yes","score":1},{"question_id":"Q03","category":"SERVICE DELIVERY","question":"Does the HCF recognise poor performance?","response":"no","score":0},{"question_id":"Q04","category":"SERVICE DELIVERY","question":"Does the HCF give honest explanation of the reasons for poor performance?","response":"yes","score":1},{"question_id":"Q05","category":"SERVICE DELIVERY","question":"Does the HCF take remedial action for poor performance?","response":"yes","score":1},{"question_id":"Q06","category":"TIMELINESS","question":"Are staff seen and perceived to provide prompt service?","response":"yes","score":1},{"question_id":"Q07","category":"TIMELINESS","question":"Is there any system in place to monitor waiting time?","response":"yes","score":1},{"question_id":"Q08","category":"TIMELINESS","question":"Is there reasonable explanation for delays that are not a regular occurrence?","response":"yes","score":1},{"question_id":"Q09","category":"TIMELINESS","question":"Are customers told of any unforeseen interruptions to service?","response":"yes","score":1},{"question_id":"Q10","category":"INFORMATION","question":"Does the healthcare facility publish the NHIS drug list?","response":"no","score":0},{"question_id":"Q11","category":"INFORMATION","question":"Does the HCF give enrollees sufficient information with respect to referrals?","response":"yes","score":1},{"question_id":"Q12","category":"PROFESSIONALISM","question":"Are appointment procedures clearly detailed at all service points for enrollees to see?","response":"yes","score":1},{"question_id":"Q13","category":"PROFESSIONALISM","question":"Are staff courteous and professional in their dealings with enrollees?","response":"yes","score":1}]', 11, 13, 84.6,
 'SERVICOM Seed Batch', NOW(), NOW()),

('SAT-SEED-020', @zn_enugu, @st_enugu, 'Delta State University Teaching Hospital', '2026-03-03',
 'Mr. Ahmed Sani', 'Field Assessment Unit', '[{"question_id":"Q01","category":"SERVICE DELIVERY","question":"Are there physical or bureaucratic obstacles to access?","response":"yes","score":1},{"question_id":"Q02","category":"SERVICE DELIVERY","question":"Is the facility open for NHIS enrollees only during working hours?","response":"yes","score":1},{"question_id":"Q03","category":"SERVICE DELIVERY","question":"Does the HCF recognise poor performance?","response":"yes","score":1},{"question_id":"Q04","category":"SERVICE DELIVERY","question":"Does the HCF give honest explanation of the reasons for poor performance?","response":"yes","score":1},{"question_id":"Q05","category":"SERVICE DELIVERY","question":"Does the HCF take remedial action for poor performance?","response":"yes","score":1},{"question_id":"Q06","category":"TIMELINESS","question":"Are staff seen and perceived to provide prompt service?","response":"yes","score":1},{"question_id":"Q07","category":"TIMELINESS","question":"Is there any system in place to monitor waiting time?","response":"yes","score":1},{"question_id":"Q08","category":"TIMELINESS","question":"Is there reasonable explanation for delays that are not a regular occurrence?","response":"no","score":0},{"question_id":"Q09","category":"TIMELINESS","question":"Are customers told of any unforeseen interruptions to service?","response":"no","score":0},{"question_id":"Q10","category":"INFORMATION","question":"Does the healthcare facility publish the NHIS drug list?","response":"yes","score":1},{"question_id":"Q11","category":"INFORMATION","question":"Does the HCF give enrollees sufficient information with respect to referrals?","response":"yes","score":1},{"question_id":"Q12","category":"PROFESSIONALISM","question":"Are appointment procedures clearly detailed at all service points for enrollees to see?","response":"yes","score":1},{"question_id":"Q13","category":"PROFESSIONALISM","question":"Are staff courteous and professional in their dealings with enrollees?","response":"no","score":0}]', 10, 13, 76.9,
 'SERVICOM Seed Batch', NOW(), NOW()),

('SAT-SEED-021', @zn_lag, @st_lag, 'Federal Medical Centre Yola', '2026-03-06',
 'Mrs. Ada Okafor', 'Zone A SERVICOM', '[{"question_id":"Q01","category":"SERVICE DELIVERY","question":"Are there physical or bureaucratic obstacles to access?","response":"no","score":0},{"question_id":"Q02","category":"SERVICE DELIVERY","question":"Is the facility open for NHIS enrollees only during working hours?","response":"no","score":0},{"question_id":"Q03","category":"SERVICE DELIVERY","question":"Does the HCF recognise poor performance?","response":"yes","score":1},{"question_id":"Q04","category":"SERVICE DELIVERY","question":"Does the HCF give honest explanation of the reasons for poor performance?","response":"yes","score":1},{"question_id":"Q05","category":"SERVICE DELIVERY","question":"Does the HCF take remedial action for poor performance?","response":"no","score":0},{"question_id":"Q06","category":"TIMELINESS","question":"Are staff seen and perceived to provide prompt service?","response":"no","score":0},{"question_id":"Q07","category":"TIMELINESS","question":"Is there any system in place to monitor waiting time?","response":"no","score":0},{"question_id":"Q08","category":"TIMELINESS","question":"Is there reasonable explanation for delays that are not a regular occurrence?","response":"no","score":0},{"question_id":"Q09","category":"TIMELINESS","question":"Are customers told of any unforeseen interruptions to service?","response":"no","score":0},{"question_id":"Q10","category":"INFORMATION","question":"Does the healthcare facility publish the NHIS drug list?","response":"yes","score":1},{"question_id":"Q11","category":"INFORMATION","question":"Does the HCF give enrollees sufficient information with respect to referrals?","response":"no","score":0},{"question_id":"Q12","category":"PROFESSIONALISM","question":"Are appointment procedures clearly detailed at all service points for enrollees to see?","response":"yes","score":1},{"question_id":"Q13","category":"PROFESSIONALISM","question":"Are staff courteous and professional in their dealings with enrollees?","response":"no","score":0}]', 4, 13, 30.8,
 'SERVICOM Seed Batch', NOW(), NOW()),

('SAT-SEED-022', @zn_kan, @st_kan, 'University of Calabar Teaching Hospital', '2026-03-09',
 'Mr. Ibrahim Musa', 'Zone B SERVICOM', '[{"question_id":"Q01","category":"SERVICE DELIVERY","question":"Are there physical or bureaucratic obstacles to access?","response":"no","score":0},{"question_id":"Q02","category":"SERVICE DELIVERY","question":"Is the facility open for NHIS enrollees only during working hours?","response":"yes","score":1},{"question_id":"Q03","category":"SERVICE DELIVERY","question":"Does the HCF recognise poor performance?","response":"yes","score":1},{"question_id":"Q04","category":"SERVICE DELIVERY","question":"Does the HCF give honest explanation of the reasons for poor performance?","response":"yes","score":1},{"question_id":"Q05","category":"SERVICE DELIVERY","question":"Does the HCF take remedial action for poor performance?","response":"no","score":0},{"question_id":"Q06","category":"TIMELINESS","question":"Are staff seen and perceived to provide prompt service?","response":"yes","score":1},{"question_id":"Q07","category":"TIMELINESS","question":"Is there any system in place to monitor waiting time?","response":"no","score":0},{"question_id":"Q08","category":"TIMELINESS","question":"Is there reasonable explanation for delays that are not a regular occurrence?","response":"no","score":0},{"question_id":"Q09","category":"TIMELINESS","question":"Are customers told of any unforeseen interruptions to service?","response":"yes","score":1},{"question_id":"Q10","category":"INFORMATION","question":"Does the healthcare facility publish the NHIS drug list?","response":"no","score":0},{"question_id":"Q11","category":"INFORMATION","question":"Does the HCF give enrollees sufficient information with respect to referrals?","response":"yes","score":1},{"question_id":"Q12","category":"PROFESSIONALISM","question":"Are appointment procedures clearly detailed at all service points for enrollees to see?","response":"yes","score":1},{"question_id":"Q13","category":"PROFESSIONALISM","question":"Are staff courteous and professional in their dealings with enrollees?","response":"no","score":0}]', 7, 13, 53.8,
 'SERVICOM Seed Batch', NOW(), NOW()),

('SAT-SEED-023', @zn_fct, @st_fct, 'Federal Medical Centre Birnin Kebbi', '2026-03-12',
 'Mrs. Grace Etim', 'HQ Monitoring Team', '[{"question_id":"Q01","category":"SERVICE DELIVERY","question":"Are there physical or bureaucratic obstacles to access?","response":"no","score":0},{"question_id":"Q02","category":"SERVICE DELIVERY","question":"Is the facility open for NHIS enrollees only during working hours?","response":"yes","score":1},{"question_id":"Q03","category":"SERVICE DELIVERY","question":"Does the HCF recognise poor performance?","response":"yes","score":1},{"question_id":"Q04","category":"SERVICE DELIVERY","question":"Does the HCF give honest explanation of the reasons for poor performance?","response":"yes","score":1},{"question_id":"Q05","category":"SERVICE DELIVERY","question":"Does the HCF take remedial action for poor performance?","response":"yes","score":1},{"question_id":"Q06","category":"TIMELINESS","question":"Are staff seen and perceived to provide prompt service?","response":"no","score":0},{"question_id":"Q07","category":"TIMELINESS","question":"Is there any system in place to monitor waiting time?","response":"no","score":0},{"question_id":"Q08","category":"TIMELINESS","question":"Is there reasonable explanation for delays that are not a regular occurrence?","response":"yes","score":1},{"question_id":"Q09","category":"TIMELINESS","question":"Are customers told of any unforeseen interruptions to service?","response":"no","score":0},{"question_id":"Q10","category":"INFORMATION","question":"Does the healthcare facility publish the NHIS drug list?","response":"no","score":0},{"question_id":"Q11","category":"INFORMATION","question":"Does the HCF give enrollees sufficient information with respect to referrals?","response":"yes","score":1},{"question_id":"Q12","category":"PROFESSIONALISM","question":"Are appointment procedures clearly detailed at all service points for enrollees to see?","response":"yes","score":1},{"question_id":"Q13","category":"PROFESSIONALISM","question":"Are staff courteous and professional in their dealings with enrollees?","response":"yes","score":1}]', 8, 13, 61.5,
 'SERVICOM Seed Batch', NOW(), NOW()),

('SAT-SEED-024', @zn_riv, @st_riv, 'Specialist Hospital Sokoto', '2026-03-15',
 'Mr. Chinedu Okeke', 'State Desk Team', '[{"question_id":"Q01","category":"SERVICE DELIVERY","question":"Are there physical or bureaucratic obstacles to access?","response":"no","score":0},{"question_id":"Q02","category":"SERVICE DELIVERY","question":"Is the facility open for NHIS enrollees only during working hours?","response":"no","score":0},{"question_id":"Q03","category":"SERVICE DELIVERY","question":"Does the HCF recognise poor performance?","response":"yes","score":1},{"question_id":"Q04","category":"SERVICE DELIVERY","question":"Does the HCF give honest explanation of the reasons for poor performance?","response":"no","score":0},{"question_id":"Q05","category":"SERVICE DELIVERY","question":"Does the HCF take remedial action for poor performance?","response":"yes","score":1},{"question_id":"Q06","category":"TIMELINESS","question":"Are staff seen and perceived to provide prompt service?","response":"yes","score":1},{"question_id":"Q07","category":"TIMELINESS","question":"Is there any system in place to monitor waiting time?","response":"yes","score":1},{"question_id":"Q08","category":"TIMELINESS","question":"Is there reasonable explanation for delays that are not a regular occurrence?","response":"yes","score":1},{"question_id":"Q09","category":"TIMELINESS","question":"Are customers told of any unforeseen interruptions to service?","response":"no","score":0},{"question_id":"Q10","category":"INFORMATION","question":"Does the healthcare facility publish the NHIS drug list?","response":"no","score":0},{"question_id":"Q11","category":"INFORMATION","question":"Does the HCF give enrollees sufficient information with respect to referrals?","response":"no","score":0},{"question_id":"Q12","category":"PROFESSIONALISM","question":"Are appointment procedures clearly detailed at all service points for enrollees to see?","response":"no","score":0},{"question_id":"Q13","category":"PROFESSIONALISM","question":"Are staff courteous and professional in their dealings with enrollees?","response":"yes","score":1}]', 6, 13, 46.2,
 'SERVICOM Seed Batch', NOW(), NOW()),

('SAT-SEED-025', @zn_kad, @st_kad, 'Federal Medical Centre Azare', '2026-03-18',
 'Mrs. Fatima Bello', 'Field Assessment Unit', '[{"question_id":"Q01","category":"SERVICE DELIVERY","question":"Are there physical or bureaucratic obstacles to access?","response":"yes","score":1},{"question_id":"Q02","category":"SERVICE DELIVERY","question":"Is the facility open for NHIS enrollees only during working hours?","response":"yes","score":1},{"question_id":"Q03","category":"SERVICE DELIVERY","question":"Does the HCF recognise poor performance?","response":"no","score":0},{"question_id":"Q04","category":"SERVICE DELIVERY","question":"Does the HCF give honest explanation of the reasons for poor performance?","response":"no","score":0},{"question_id":"Q05","category":"SERVICE DELIVERY","question":"Does the HCF take remedial action for poor performance?","response":"yes","score":1},{"question_id":"Q06","category":"TIMELINESS","question":"Are staff seen and perceived to provide prompt service?","response":"yes","score":1},{"question_id":"Q07","category":"TIMELINESS","question":"Is there any system in place to monitor waiting time?","response":"yes","score":1},{"question_id":"Q08","category":"TIMELINESS","question":"Is there reasonable explanation for delays that are not a regular occurrence?","response":"no","score":0},{"question_id":"Q09","category":"TIMELINESS","question":"Are customers told of any unforeseen interruptions to service?","response":"no","score":0},{"question_id":"Q10","category":"INFORMATION","question":"Does the healthcare facility publish the NHIS drug list?","response":"no","score":0},{"question_id":"Q11","category":"INFORMATION","question":"Does the HCF give enrollees sufficient information with respect to referrals?","response":"no","score":0},{"question_id":"Q12","category":"PROFESSIONALISM","question":"Are appointment procedures clearly detailed at all service points for enrollees to see?","response":"no","score":0},{"question_id":"Q13","category":"PROFESSIONALISM","question":"Are staff courteous and professional in their dealings with enrollees?","response":"yes","score":1}]', 6, 13, 46.2,
 'SERVICOM Seed Batch', NOW(), NOW()),

('SAT-SEED-026', @zn_imo, @st_imo, 'Nnamdi Azikiwe University Teaching Hospital', '2026-03-21',
 'Mr. Tunde Adebayo', 'Zone A SERVICOM', '[{"question_id":"Q01","category":"SERVICE DELIVERY","question":"Are there physical or bureaucratic obstacles to access?","response":"no","score":0},{"question_id":"Q02","category":"SERVICE DELIVERY","question":"Is the facility open for NHIS enrollees only during working hours?","response":"yes","score":1},{"question_id":"Q03","category":"SERVICE DELIVERY","question":"Does the HCF recognise poor performance?","response":"no","score":0},{"question_id":"Q04","category":"SERVICE DELIVERY","question":"Does the HCF give honest explanation of the reasons for poor performance?","response":"no","score":0},{"question_id":"Q05","category":"SERVICE DELIVERY","question":"Does the HCF take remedial action for poor performance?","response":"no","score":0},{"question_id":"Q06","category":"TIMELINESS","question":"Are staff seen and perceived to provide prompt service?","response":"no","score":0},{"question_id":"Q07","category":"TIMELINESS","question":"Is there any system in place to monitor waiting time?","response":"yes","score":1},{"question_id":"Q08","category":"TIMELINESS","question":"Is there reasonable explanation for delays that are not a regular occurrence?","response":"no","score":0},{"question_id":"Q09","category":"TIMELINESS","question":"Are customers told of any unforeseen interruptions to service?","response":"yes","score":1},{"question_id":"Q10","category":"INFORMATION","question":"Does the healthcare facility publish the NHIS drug list?","response":"no","score":0},{"question_id":"Q11","category":"INFORMATION","question":"Does the HCF give enrollees sufficient information with respect to referrals?","response":"no","score":0},{"question_id":"Q12","category":"PROFESSIONALISM","question":"Are appointment procedures clearly detailed at all service points for enrollees to see?","response":"yes","score":1},{"question_id":"Q13","category":"PROFESSIONALISM","question":"Are staff courteous and professional in their dealings with enrollees?","response":"no","score":0}]', 4, 13, 30.8,
 'SERVICOM Seed Batch', NOW(), NOW()),

('SAT-SEED-027', @zn_ond, @st_ond, 'Federal Medical Centre Keffi', '2026-03-24',
 'Mrs. Ngozi Eze', 'Zone B SERVICOM', '[{"question_id":"Q01","category":"SERVICE DELIVERY","question":"Are there physical or bureaucratic obstacles to access?","response":"yes","score":1},{"question_id":"Q02","category":"SERVICE DELIVERY","question":"Is the facility open for NHIS enrollees only during working hours?","response":"yes","score":1},{"question_id":"Q03","category":"SERVICE DELIVERY","question":"Does the HCF recognise poor performance?","response":"no","score":0},{"question_id":"Q04","category":"SERVICE DELIVERY","question":"Does the HCF give honest explanation of the reasons for poor performance?","response":"yes","score":1},{"question_id":"Q05","category":"SERVICE DELIVERY","question":"Does the HCF take remedial action for poor performance?","response":"yes","score":1},{"question_id":"Q06","category":"TIMELINESS","question":"Are staff seen and perceived to provide prompt service?","response":"yes","score":1},{"question_id":"Q07","category":"TIMELINESS","question":"Is there any system in place to monitor waiting time?","response":"yes","score":1},{"question_id":"Q08","category":"TIMELINESS","question":"Is there reasonable explanation for delays that are not a regular occurrence?","response":"no","score":0},{"question_id":"Q09","category":"TIMELINESS","question":"Are customers told of any unforeseen interruptions to service?","response":"no","score":0},{"question_id":"Q10","category":"INFORMATION","question":"Does the healthcare facility publish the NHIS drug list?","response":"yes","score":1},{"question_id":"Q11","category":"INFORMATION","question":"Does the HCF give enrollees sufficient information with respect to referrals?","response":"yes","score":1},{"question_id":"Q12","category":"PROFESSIONALISM","question":"Are appointment procedures clearly detailed at all service points for enrollees to see?","response":"yes","score":1},{"question_id":"Q13","category":"PROFESSIONALISM","question":"Are staff courteous and professional in their dealings with enrollees?","response":"no","score":0}]', 9, 13, 69.2,
 'SERVICOM Seed Batch', NOW(), NOW()),

('SAT-SEED-028', @zn_ben, @st_ben, 'Obafemi Awolowo University Teaching Hospital', '2026-03-27',
 'Mr. Yusuf Aliyu', 'HQ Monitoring Team', '[{"question_id":"Q01","category":"SERVICE DELIVERY","question":"Are there physical or bureaucratic obstacles to access?","response":"yes","score":1},{"question_id":"Q02","category":"SERVICE DELIVERY","question":"Is the facility open for NHIS enrollees only during working hours?","response":"no","score":0},{"question_id":"Q03","category":"SERVICE DELIVERY","question":"Does the HCF recognise poor performance?","response":"yes","score":1},{"question_id":"Q04","category":"SERVICE DELIVERY","question":"Does the HCF give honest explanation of the reasons for poor performance?","response":"no","score":0},{"question_id":"Q05","category":"SERVICE DELIVERY","question":"Does the HCF take remedial action for poor performance?","response":"yes","score":1},{"question_id":"Q06","category":"TIMELINESS","question":"Are staff seen and perceived to provide prompt service?","response":"no","score":0},{"question_id":"Q07","category":"TIMELINESS","question":"Is there any system in place to monitor waiting time?","response":"yes","score":1},{"question_id":"Q08","category":"TIMELINESS","question":"Is there reasonable explanation for delays that are not a regular occurrence?","response":"yes","score":1},{"question_id":"Q09","category":"TIMELINESS","question":"Are customers told of any unforeseen interruptions to service?","response":"yes","score":1},{"question_id":"Q10","category":"INFORMATION","question":"Does the healthcare facility publish the NHIS drug list?","response":"yes","score":1},{"question_id":"Q11","category":"INFORMATION","question":"Does the HCF give enrollees sufficient information with respect to referrals?","response":"yes","score":1},{"question_id":"Q12","category":"PROFESSIONALISM","question":"Are appointment procedures clearly detailed at all service points for enrollees to see?","response":"yes","score":1},{"question_id":"Q13","category":"PROFESSIONALISM","question":"Are staff courteous and professional in their dealings with enrollees?","response":"yes","score":1}]', 10, 13, 76.9,
 'SERVICOM Seed Batch', NOW(), NOW()),

('SAT-SEED-029', @zn_oyo, @st_oyo, 'Federal Medical Centre Jalingo', '2026-03-30',
 'Mrs. Blessing Okoro', 'State Desk Team', '[{"question_id":"Q01","category":"SERVICE DELIVERY","question":"Are there physical or bureaucratic obstacles to access?","response":"yes","score":1},{"question_id":"Q02","category":"SERVICE DELIVERY","question":"Is the facility open for NHIS enrollees only during working hours?","response":"yes","score":1},{"question_id":"Q03","category":"SERVICE DELIVERY","question":"Does the HCF recognise poor performance?","response":"yes","score":1},{"question_id":"Q04","category":"SERVICE DELIVERY","question":"Does the HCF give honest explanation of the reasons for poor performance?","response":"yes","score":1},{"question_id":"Q05","category":"SERVICE DELIVERY","question":"Does the HCF take remedial action for poor performance?","response":"yes","score":1},{"question_id":"Q06","category":"TIMELINESS","question":"Are staff seen and perceived to provide prompt service?","response":"no","score":0},{"question_id":"Q07","category":"TIMELINESS","question":"Is there any system in place to monitor waiting time?","response":"yes","score":1},{"question_id":"Q08","category":"TIMELINESS","question":"Is there reasonable explanation for delays that are not a regular occurrence?","response":"yes","score":1},{"question_id":"Q09","category":"TIMELINESS","question":"Are customers told of any unforeseen interruptions to service?","response":"yes","score":1},{"question_id":"Q10","category":"INFORMATION","question":"Does the healthcare facility publish the NHIS drug list?","response":"yes","score":1},{"question_id":"Q11","category":"INFORMATION","question":"Does the HCF give enrollees sufficient information with respect to referrals?","response":"yes","score":1},{"question_id":"Q12","category":"PROFESSIONALISM","question":"Are appointment procedures clearly detailed at all service points for enrollees to see?","response":"yes","score":1},{"question_id":"Q13","category":"PROFESSIONALISM","question":"Are staff courteous and professional in their dealings with enrollees?","response":"yes","score":1}]', 12, 13, 92.3,
 'SERVICOM Seed Batch', NOW(), NOW()),

('SAT-SEED-030', @zn_enugu, @st_enugu, 'University of Benin Teaching Hospital', '2026-04-02',
 'Mr. Ahmed Sani', 'Field Assessment Unit', '[{"question_id":"Q01","category":"SERVICE DELIVERY","question":"Are there physical or bureaucratic obstacles to access?","response":"yes","score":1},{"question_id":"Q02","category":"SERVICE DELIVERY","question":"Is the facility open for NHIS enrollees only during working hours?","response":"yes","score":1},{"question_id":"Q03","category":"SERVICE DELIVERY","question":"Does the HCF recognise poor performance?","response":"yes","score":1},{"question_id":"Q04","category":"SERVICE DELIVERY","question":"Does the HCF give honest explanation of the reasons for poor performance?","response":"yes","score":1},{"question_id":"Q05","category":"SERVICE DELIVERY","question":"Does the HCF take remedial action for poor performance?","response":"yes","score":1},{"question_id":"Q06","category":"TIMELINESS","question":"Are staff seen and perceived to provide prompt service?","response":"yes","score":1},{"question_id":"Q07","category":"TIMELINESS","question":"Is there any system in place to monitor waiting time?","response":"yes","score":1},{"question_id":"Q08","category":"TIMELINESS","question":"Is there reasonable explanation for delays that are not a regular occurrence?","response":"yes","score":1},{"question_id":"Q09","category":"TIMELINESS","question":"Are customers told of any unforeseen interruptions to service?","response":"yes","score":1},{"question_id":"Q10","category":"INFORMATION","question":"Does the healthcare facility publish the NHIS drug list?","response":"yes","score":1},{"question_id":"Q11","category":"INFORMATION","question":"Does the HCF give enrollees sufficient information with respect to referrals?","response":"yes","score":1},{"question_id":"Q12","category":"PROFESSIONALISM","question":"Are appointment procedures clearly detailed at all service points for enrollees to see?","response":"no","score":0},{"question_id":"Q13","category":"PROFESSIONALISM","question":"Are staff courteous and professional in their dealings with enrollees?","response":"yes","score":1}]', 12, 13, 92.3,
 'SERVICOM Seed Batch', NOW(), NOW());


-- =============================================================================
-- 2) CHARTER PERFORMANCE / COMMENT CARDS (30)
-- =============================================================================

INSERT INTO servicom_comment_cards (
  reference_id, zone_id, state_id, respondent_name, organisation, card_date,
  responses, total_score, average_score, created_by, created_at, updated_at
) VALUES

('CCC-SEED-001', @zn_lag, @st_lag, 'Aisha Bello', 'NHIA Enrollee', '2026-01-06',
 '[{"question_id":"Q01","section":"Reception","question":"How would you rate the quality of service received at our reception?","response":"3","score":3},{"question_id":"Q02","section":"Front Desk Staff","question":"Front desk staff are courteous & polite","response":"2","score":2},{"question_id":"Q03","section":"Front Desk Staff","question":"Front desk staff are professional & well-informed","response":"2","score":2},{"question_id":"Q04","section":"Front Desk Staff","question":"Front desk staff are prompt & efficient","response":"2","score":2},{"question_id":"Q05","section":"Overall","question":"Overall rating of the quality of service / interaction within our organisation","response":"2","score":2}]', 11, 2.2,
 'SERVICOM Seed Batch', NOW(), NOW()),

('CCC-SEED-002', @zn_kan, @st_kan, 'Chukwudi Nwosu', 'Federal Civil Service', '2026-01-08',
 '[{"question_id":"Q01","section":"Reception","question":"How would you rate the quality of service received at our reception?","response":"3","score":3},{"question_id":"Q02","section":"Front Desk Staff","question":"Front desk staff are courteous & polite","response":"2","score":2},{"question_id":"Q03","section":"Front Desk Staff","question":"Front desk staff are professional & well-informed","response":"3","score":3},{"question_id":"Q04","section":"Front Desk Staff","question":"Front desk staff are prompt & efficient","response":"3","score":3},{"question_id":"Q05","section":"Overall","question":"Overall rating of the quality of service / interaction within our organisation","response":"3","score":3}]', 14, 2.8,
 'SERVICOM Seed Batch', NOW(), NOW()),

('CCC-SEED-003', @zn_fct, @st_fct, 'Fatima Yusuf', 'State Civil Service', '2026-01-10',
 '[{"question_id":"Q01","section":"Reception","question":"How would you rate the quality of service received at our reception?","response":"3","score":3},{"question_id":"Q02","section":"Front Desk Staff","question":"Front desk staff are courteous & polite","response":"2","score":2},{"question_id":"Q03","section":"Front Desk Staff","question":"Front desk staff are professional & well-informed","response":"3","score":3},{"question_id":"Q04","section":"Front Desk Staff","question":"Front desk staff are prompt & efficient","response":"3","score":3},{"question_id":"Q05","section":"Overall","question":"Overall rating of the quality of service / interaction within our organisation","response":"4","score":4}]', 15, 3.0,
 'SERVICOM Seed Batch', NOW(), NOW()),

('CCC-SEED-004', @zn_riv, @st_riv, 'Emeka Obi', 'Private Sector Enrollee', '2026-01-12',
 '[{"question_id":"Q01","section":"Reception","question":"How would you rate the quality of service received at our reception?","response":"3","score":3},{"question_id":"Q02","section":"Front Desk Staff","question":"Front desk staff are courteous & polite","response":"2","score":2},{"question_id":"Q03","section":"Front Desk Staff","question":"Front desk staff are professional & well-informed","response":"3","score":3},{"question_id":"Q04","section":"Front Desk Staff","question":"Front desk staff are prompt & efficient","response":"3","score":3},{"question_id":"Q05","section":"Overall","question":"Overall rating of the quality of service / interaction within our organisation","response":"3","score":3}]', 14, 2.8,
 'SERVICOM Seed Batch', NOW(), NOW()),

('CCC-SEED-005', @zn_kad, @st_kad, 'Hauwa Ibrahim', 'NHIA Enrollee', '2026-01-14',
 '[{"question_id":"Q01","section":"Reception","question":"How would you rate the quality of service received at our reception?","response":"4","score":4},{"question_id":"Q02","section":"Front Desk Staff","question":"Front desk staff are courteous & polite","response":"3","score":3},{"question_id":"Q03","section":"Front Desk Staff","question":"Front desk staff are professional & well-informed","response":"3","score":3},{"question_id":"Q04","section":"Front Desk Staff","question":"Front desk staff are prompt & efficient","response":"3","score":3},{"question_id":"Q05","section":"Overall","question":"Overall rating of the quality of service / interaction within our organisation","response":"3","score":3}]', 16, 3.2,
 'SERVICOM Seed Batch', NOW(), NOW()),

('CCC-SEED-006', @zn_imo, @st_imo, 'Tolu Adeyemi', 'Corporate Enrollee', '2026-01-16',
 '[{"question_id":"Q01","section":"Reception","question":"How would you rate the quality of service received at our reception?","response":"3","score":3},{"question_id":"Q02","section":"Front Desk Staff","question":"Front desk staff are courteous & polite","response":"3","score":3},{"question_id":"Q03","section":"Front Desk Staff","question":"Front desk staff are professional & well-informed","response":"3","score":3},{"question_id":"Q04","section":"Front Desk Staff","question":"Front desk staff are prompt & efficient","response":"4","score":4},{"question_id":"Q05","section":"Overall","question":"Overall rating of the quality of service / interaction within our organisation","response":"3","score":3}]', 16, 3.2,
 'SERVICOM Seed Batch', NOW(), NOW()),

('CCC-SEED-007', @zn_ond, @st_ond, 'Blessing Okoro', 'Dependent Enrollee', '2026-01-18',
 '[{"question_id":"Q01","section":"Reception","question":"How would you rate the quality of service received at our reception?","response":"4","score":4},{"question_id":"Q02","section":"Front Desk Staff","question":"Front desk staff are courteous & polite","response":"4","score":4},{"question_id":"Q03","section":"Front Desk Staff","question":"Front desk staff are professional & well-informed","response":"3","score":3},{"question_id":"Q04","section":"Front Desk Staff","question":"Front desk staff are prompt & efficient","response":"4","score":4},{"question_id":"Q05","section":"Overall","question":"Overall rating of the quality of service / interaction within our organisation","response":"4","score":4}]', 19, 3.8,
 'SERVICOM Seed Batch', NOW(), NOW()),

('CCC-SEED-008', @zn_ben, @st_ben, 'Sani Mohammed', 'NHIA Enrollee', '2026-01-20',
 '[{"question_id":"Q01","section":"Reception","question":"How would you rate the quality of service received at our reception?","response":"4","score":4},{"question_id":"Q02","section":"Front Desk Staff","question":"Front desk staff are courteous & polite","response":"4","score":4},{"question_id":"Q03","section":"Front Desk Staff","question":"Front desk staff are professional & well-informed","response":"3","score":3},{"question_id":"Q04","section":"Front Desk Staff","question":"Front desk staff are prompt & efficient","response":"4","score":4},{"question_id":"Q05","section":"Overall","question":"Overall rating of the quality of service / interaction within our organisation","response":"5","score":5}]', 20, 4.0,
 'SERVICOM Seed Batch', NOW(), NOW()),

('CCC-SEED-009', @zn_oyo, @st_oyo, 'Ngozi Eze', 'Public Servant', '2026-01-22',
 '[{"question_id":"Q01","section":"Reception","question":"How would you rate the quality of service received at our reception?","response":"2","score":2},{"question_id":"Q02","section":"Front Desk Staff","question":"Front desk staff are courteous & polite","response":"2","score":2},{"question_id":"Q03","section":"Front Desk Staff","question":"Front desk staff are professional & well-informed","response":"2","score":2},{"question_id":"Q04","section":"Front Desk Staff","question":"Front desk staff are prompt & efficient","response":"3","score":3},{"question_id":"Q05","section":"Overall","question":"Overall rating of the quality of service / interaction within our organisation","response":"3","score":3}]', 12, 2.4,
 'SERVICOM Seed Batch', NOW(), NOW()),

('CCC-SEED-010', @zn_enugu, @st_enugu, 'Ibrahim Musa', 'Military Enrollee', '2026-01-24',
 '[{"question_id":"Q01","section":"Reception","question":"How would you rate the quality of service received at our reception?","response":"2","score":2},{"question_id":"Q02","section":"Front Desk Staff","question":"Front desk staff are courteous & polite","response":"2","score":2},{"question_id":"Q03","section":"Front Desk Staff","question":"Front desk staff are professional & well-informed","response":"3","score":3},{"question_id":"Q04","section":"Front Desk Staff","question":"Front desk staff are prompt & efficient","response":"2","score":2},{"question_id":"Q05","section":"Overall","question":"Overall rating of the quality of service / interaction within our organisation","response":"3","score":3}]', 12, 2.4,
 'SERVICOM Seed Batch', NOW(), NOW()),

('CCC-SEED-011', @zn_lag, @st_lag, 'Aisha Bello', 'NHIA Enrollee', '2026-01-26',
 '[{"question_id":"Q01","section":"Reception","question":"How would you rate the quality of service received at our reception?","response":"3","score":3},{"question_id":"Q02","section":"Front Desk Staff","question":"Front desk staff are courteous & polite","response":"3","score":3},{"question_id":"Q03","section":"Front Desk Staff","question":"Front desk staff are professional & well-informed","response":"3","score":3},{"question_id":"Q04","section":"Front Desk Staff","question":"Front desk staff are prompt & efficient","response":"3","score":3},{"question_id":"Q05","section":"Overall","question":"Overall rating of the quality of service / interaction within our organisation","response":"4","score":4}]', 16, 3.2,
 'SERVICOM Seed Batch', NOW(), NOW()),

('CCC-SEED-012', @zn_kan, @st_kan, 'Chukwudi Nwosu', 'Federal Civil Service', '2026-01-28',
 '[{"question_id":"Q01","section":"Reception","question":"How would you rate the quality of service received at our reception?","response":"4","score":4},{"question_id":"Q02","section":"Front Desk Staff","question":"Front desk staff are courteous & polite","response":"3","score":3},{"question_id":"Q03","section":"Front Desk Staff","question":"Front desk staff are professional & well-informed","response":"3","score":3},{"question_id":"Q04","section":"Front Desk Staff","question":"Front desk staff are prompt & efficient","response":"3","score":3},{"question_id":"Q05","section":"Overall","question":"Overall rating of the quality of service / interaction within our organisation","response":"4","score":4}]', 17, 3.4,
 'SERVICOM Seed Batch', NOW(), NOW()),

('CCC-SEED-013', @zn_fct, @st_fct, 'Fatima Yusuf', 'State Civil Service', '2026-01-30',
 '[{"question_id":"Q01","section":"Reception","question":"How would you rate the quality of service received at our reception?","response":"4","score":4},{"question_id":"Q02","section":"Front Desk Staff","question":"Front desk staff are courteous & polite","response":"3","score":3},{"question_id":"Q03","section":"Front Desk Staff","question":"Front desk staff are professional & well-informed","response":"3","score":3},{"question_id":"Q04","section":"Front Desk Staff","question":"Front desk staff are prompt & efficient","response":"3","score":3},{"question_id":"Q05","section":"Overall","question":"Overall rating of the quality of service / interaction within our organisation","response":"3","score":3}]', 16, 3.2,
 'SERVICOM Seed Batch', NOW(), NOW()),

('CCC-SEED-014', @zn_riv, @st_riv, 'Emeka Obi', 'Private Sector Enrollee', '2026-02-01',
 '[{"question_id":"Q01","section":"Reception","question":"How would you rate the quality of service received at our reception?","response":"4","score":4},{"question_id":"Q02","section":"Front Desk Staff","question":"Front desk staff are courteous & polite","response":"4","score":4},{"question_id":"Q03","section":"Front Desk Staff","question":"Front desk staff are professional & well-informed","response":"3","score":3},{"question_id":"Q04","section":"Front Desk Staff","question":"Front desk staff are prompt & efficient","response":"3","score":3},{"question_id":"Q05","section":"Overall","question":"Overall rating of the quality of service / interaction within our organisation","response":"4","score":4}]', 18, 3.6,
 'SERVICOM Seed Batch', NOW(), NOW()),

('CCC-SEED-015', @zn_kad, @st_kad, 'Hauwa Ibrahim', 'NHIA Enrollee', '2026-02-03',
 '[{"question_id":"Q01","section":"Reception","question":"How would you rate the quality of service received at our reception?","response":"4","score":4},{"question_id":"Q02","section":"Front Desk Staff","question":"Front desk staff are courteous & polite","response":"3","score":3},{"question_id":"Q03","section":"Front Desk Staff","question":"Front desk staff are professional & well-informed","response":"3","score":3},{"question_id":"Q04","section":"Front Desk Staff","question":"Front desk staff are prompt & efficient","response":"3","score":3},{"question_id":"Q05","section":"Overall","question":"Overall rating of the quality of service / interaction within our organisation","response":"4","score":4}]', 17, 3.4,
 'SERVICOM Seed Batch', NOW(), NOW()),

('CCC-SEED-016', @zn_imo, @st_imo, 'Tolu Adeyemi', 'Corporate Enrollee', '2026-02-05',
 '[{"question_id":"Q01","section":"Reception","question":"How would you rate the quality of service received at our reception?","response":"4","score":4},{"question_id":"Q02","section":"Front Desk Staff","question":"Front desk staff are courteous & polite","response":"3","score":3},{"question_id":"Q03","section":"Front Desk Staff","question":"Front desk staff are professional & well-informed","response":"4","score":4},{"question_id":"Q04","section":"Front Desk Staff","question":"Front desk staff are prompt & efficient","response":"4","score":4},{"question_id":"Q05","section":"Overall","question":"Overall rating of the quality of service / interaction within our organisation","response":"4","score":4}]', 19, 3.8,
 'SERVICOM Seed Batch', NOW(), NOW()),

('CCC-SEED-017', @zn_ond, @st_ond, 'Blessing Okoro', 'Dependent Enrollee', '2026-02-07',
 '[{"question_id":"Q01","section":"Reception","question":"How would you rate the quality of service received at our reception?","response":"2","score":2},{"question_id":"Q02","section":"Front Desk Staff","question":"Front desk staff are courteous & polite","response":"2","score":2},{"question_id":"Q03","section":"Front Desk Staff","question":"Front desk staff are professional & well-informed","response":"2","score":2},{"question_id":"Q04","section":"Front Desk Staff","question":"Front desk staff are prompt & efficient","response":"2","score":2},{"question_id":"Q05","section":"Overall","question":"Overall rating of the quality of service / interaction within our organisation","response":"2","score":2}]', 10, 2.0,
 'SERVICOM Seed Batch', NOW(), NOW()),

('CCC-SEED-018', @zn_ben, @st_ben, 'Sani Mohammed', 'NHIA Enrollee', '2026-02-09',
 '[{"question_id":"Q01","section":"Reception","question":"How would you rate the quality of service received at our reception?","response":"4","score":4},{"question_id":"Q02","section":"Front Desk Staff","question":"Front desk staff are courteous & polite","response":"3","score":3},{"question_id":"Q03","section":"Front Desk Staff","question":"Front desk staff are professional & well-informed","response":"3","score":3},{"question_id":"Q04","section":"Front Desk Staff","question":"Front desk staff are prompt & efficient","response":"3","score":3},{"question_id":"Q05","section":"Overall","question":"Overall rating of the quality of service / interaction within our organisation","response":"3","score":3}]', 16, 3.2,
 'SERVICOM Seed Batch', NOW(), NOW()),

('CCC-SEED-019', @zn_oyo, @st_oyo, 'Ngozi Eze', 'Public Servant', '2026-02-11',
 '[{"question_id":"Q01","section":"Reception","question":"How would you rate the quality of service received at our reception?","response":"3","score":3},{"question_id":"Q02","section":"Front Desk Staff","question":"Front desk staff are courteous & polite","response":"2","score":2},{"question_id":"Q03","section":"Front Desk Staff","question":"Front desk staff are professional & well-informed","response":"2","score":2},{"question_id":"Q04","section":"Front Desk Staff","question":"Front desk staff are prompt & efficient","response":"3","score":3},{"question_id":"Q05","section":"Overall","question":"Overall rating of the quality of service / interaction within our organisation","response":"4","score":4}]', 14, 2.8,
 'SERVICOM Seed Batch', NOW(), NOW()),

('CCC-SEED-020', @zn_enugu, @st_enugu, 'Ibrahim Musa', 'Military Enrollee', '2026-02-13',
 '[{"question_id":"Q01","section":"Reception","question":"How would you rate the quality of service received at our reception?","response":"4","score":4},{"question_id":"Q02","section":"Front Desk Staff","question":"Front desk staff are courteous & polite","response":"3","score":3},{"question_id":"Q03","section":"Front Desk Staff","question":"Front desk staff are professional & well-informed","response":"3","score":3},{"question_id":"Q04","section":"Front Desk Staff","question":"Front desk staff are prompt & efficient","response":"3","score":3},{"question_id":"Q05","section":"Overall","question":"Overall rating of the quality of service / interaction within our organisation","response":"4","score":4}]', 17, 3.4,
 'SERVICOM Seed Batch', NOW(), NOW()),

('CCC-SEED-021', @zn_lag, @st_lag, 'Aisha Bello', 'NHIA Enrollee', '2026-02-15',
 '[{"question_id":"Q01","section":"Reception","question":"How would you rate the quality of service received at our reception?","response":"3","score":3},{"question_id":"Q02","section":"Front Desk Staff","question":"Front desk staff are courteous & polite","response":"3","score":3},{"question_id":"Q03","section":"Front Desk Staff","question":"Front desk staff are professional & well-informed","response":"3","score":3},{"question_id":"Q04","section":"Front Desk Staff","question":"Front desk staff are prompt & efficient","response":"2","score":2},{"question_id":"Q05","section":"Overall","question":"Overall rating of the quality of service / interaction within our organisation","response":"3","score":3}]', 14, 2.8,
 'SERVICOM Seed Batch', NOW(), NOW()),

('CCC-SEED-022', @zn_kan, @st_kan, 'Chukwudi Nwosu', 'Federal Civil Service', '2026-02-17',
 '[{"question_id":"Q01","section":"Reception","question":"How would you rate the quality of service received at our reception?","response":"4","score":4},{"question_id":"Q02","section":"Front Desk Staff","question":"Front desk staff are courteous & polite","response":"3","score":3},{"question_id":"Q03","section":"Front Desk Staff","question":"Front desk staff are professional & well-informed","response":"3","score":3},{"question_id":"Q04","section":"Front Desk Staff","question":"Front desk staff are prompt & efficient","response":"3","score":3},{"question_id":"Q05","section":"Overall","question":"Overall rating of the quality of service / interaction within our organisation","response":"3","score":3}]', 16, 3.2,
 'SERVICOM Seed Batch', NOW(), NOW()),

('CCC-SEED-023', @zn_fct, @st_fct, 'Fatima Yusuf', 'State Civil Service', '2026-02-19',
 '[{"question_id":"Q01","section":"Reception","question":"How would you rate the quality of service received at our reception?","response":"4","score":4},{"question_id":"Q02","section":"Front Desk Staff","question":"Front desk staff are courteous & polite","response":"3","score":3},{"question_id":"Q03","section":"Front Desk Staff","question":"Front desk staff are professional & well-informed","response":"3","score":3},{"question_id":"Q04","section":"Front Desk Staff","question":"Front desk staff are prompt & efficient","response":"4","score":4},{"question_id":"Q05","section":"Overall","question":"Overall rating of the quality of service / interaction within our organisation","response":"4","score":4}]', 18, 3.6,
 'SERVICOM Seed Batch', NOW(), NOW()),

('CCC-SEED-024', @zn_riv, @st_riv, 'Emeka Obi', 'Private Sector Enrollee', '2026-02-21',
 '[{"question_id":"Q01","section":"Reception","question":"How would you rate the quality of service received at our reception?","response":"5","score":5},{"question_id":"Q02","section":"Front Desk Staff","question":"Front desk staff are courteous & polite","response":"3","score":3},{"question_id":"Q03","section":"Front Desk Staff","question":"Front desk staff are professional & well-informed","response":"4","score":4},{"question_id":"Q04","section":"Front Desk Staff","question":"Front desk staff are prompt & efficient","response":"3","score":3},{"question_id":"Q05","section":"Overall","question":"Overall rating of the quality of service / interaction within our organisation","response":"4","score":4}]', 19, 3.8,
 'SERVICOM Seed Batch', NOW(), NOW()),

('CCC-SEED-025', @zn_kad, @st_kad, 'Hauwa Ibrahim', 'NHIA Enrollee', '2026-02-23',
 '[{"question_id":"Q01","section":"Reception","question":"How would you rate the quality of service received at our reception?","response":"2","score":2},{"question_id":"Q02","section":"Front Desk Staff","question":"Front desk staff are courteous & polite","response":"2","score":2},{"question_id":"Q03","section":"Front Desk Staff","question":"Front desk staff are professional & well-informed","response":"3","score":3},{"question_id":"Q04","section":"Front Desk Staff","question":"Front desk staff are prompt & efficient","response":"2","score":2},{"question_id":"Q05","section":"Overall","question":"Overall rating of the quality of service / interaction within our organisation","response":"3","score":3}]', 12, 2.4,
 'SERVICOM Seed Batch', NOW(), NOW()),

('CCC-SEED-026', @zn_imo, @st_imo, 'Tolu Adeyemi', 'Corporate Enrollee', '2026-02-25',
 '[{"question_id":"Q01","section":"Reception","question":"How would you rate the quality of service received at our reception?","response":"3","score":3},{"question_id":"Q02","section":"Front Desk Staff","question":"Front desk staff are courteous & polite","response":"2","score":2},{"question_id":"Q03","section":"Front Desk Staff","question":"Front desk staff are professional & well-informed","response":"2","score":2},{"question_id":"Q04","section":"Front Desk Staff","question":"Front desk staff are prompt & efficient","response":"2","score":2},{"question_id":"Q05","section":"Overall","question":"Overall rating of the quality of service / interaction within our organisation","response":"3","score":3}]', 12, 2.4,
 'SERVICOM Seed Batch', NOW(), NOW()),

('CCC-SEED-027', @zn_ond, @st_ond, 'Blessing Okoro', 'Dependent Enrollee', '2026-02-27',
 '[{"question_id":"Q01","section":"Reception","question":"How would you rate the quality of service received at our reception?","response":"4","score":4},{"question_id":"Q02","section":"Front Desk Staff","question":"Front desk staff are courteous & polite","response":"2","score":2},{"question_id":"Q03","section":"Front Desk Staff","question":"Front desk staff are professional & well-informed","response":"3","score":3},{"question_id":"Q04","section":"Front Desk Staff","question":"Front desk staff are prompt & efficient","response":"3","score":3},{"question_id":"Q05","section":"Overall","question":"Overall rating of the quality of service / interaction within our organisation","response":"3","score":3}]', 15, 3.0,
 'SERVICOM Seed Batch', NOW(), NOW()),

('CCC-SEED-028', @zn_ben, @st_ben, 'Sani Mohammed', 'NHIA Enrollee', '2026-03-01',
 '[{"question_id":"Q01","section":"Reception","question":"How would you rate the quality of service received at our reception?","response":"4","score":4},{"question_id":"Q02","section":"Front Desk Staff","question":"Front desk staff are courteous & polite","response":"4","score":4},{"question_id":"Q03","section":"Front Desk Staff","question":"Front desk staff are professional & well-informed","response":"2","score":2},{"question_id":"Q04","section":"Front Desk Staff","question":"Front desk staff are prompt & efficient","response":"2","score":2},{"question_id":"Q05","section":"Overall","question":"Overall rating of the quality of service / interaction within our organisation","response":"3","score":3}]', 15, 3.0,
 'SERVICOM Seed Batch', NOW(), NOW()),

('CCC-SEED-029', @zn_oyo, @st_oyo, 'Ngozi Eze', 'Public Servant', '2026-03-03',
 '[{"question_id":"Q01","section":"Reception","question":"How would you rate the quality of service received at our reception?","response":"3","score":3},{"question_id":"Q02","section":"Front Desk Staff","question":"Front desk staff are courteous & polite","response":"3","score":3},{"question_id":"Q03","section":"Front Desk Staff","question":"Front desk staff are professional & well-informed","response":"3","score":3},{"question_id":"Q04","section":"Front Desk Staff","question":"Front desk staff are prompt & efficient","response":"3","score":3},{"question_id":"Q05","section":"Overall","question":"Overall rating of the quality of service / interaction within our organisation","response":"4","score":4}]', 16, 3.2,
 'SERVICOM Seed Batch', NOW(), NOW()),

('CCC-SEED-030', @zn_enugu, @st_enugu, 'Ibrahim Musa', 'Military Enrollee', '2026-03-05',
 '[{"question_id":"Q01","section":"Reception","question":"How would you rate the quality of service received at our reception?","response":"4","score":4},{"question_id":"Q02","section":"Front Desk Staff","question":"Front desk staff are courteous & polite","response":"3","score":3},{"question_id":"Q03","section":"Front Desk Staff","question":"Front desk staff are professional & well-informed","response":"3","score":3},{"question_id":"Q04","section":"Front Desk Staff","question":"Front desk staff are prompt & efficient","response":"4","score":4},{"question_id":"Q05","section":"Overall","question":"Overall rating of the quality of service / interaction within our organisation","response":"3","score":3}]', 17, 3.4,
 'SERVICOM Seed Batch', NOW(), NOW());


-- =============================================================================
-- 3) SERVICOM COMPLAINTS (30)
-- =============================================================================

INSERT INTO servicom_complaints (
  complaint_number, zone_id, state_id, reporting_month, reporting_year,
  entry_date, complaint_date, complaint_type, complaint_category, category_code,
  complaint_domain, domain_code, offence_reference, priority_rating,
  date_received, transmission_route,
  complainant_category, complainant_id, respondent_category, respondent_id,
  officer_assigned, investigation_start_date,
  status, actions_taken, actions_details,
  escalated, escalation_level, escalation_date, escalated_to,
  resolution_days, resolution_within_sla,
  date_closed, outcome, remarks, description,
  facility_name, created_by, created_at, updated_at
) VALUES

('CMP-SEED-001', @zn_lag, @st_lag, 2, 2026,
 '2026-02-01', '2026-02-01', 'HCF', 'Billing', 'HCF-BILL-001',
 'Financial', 'FIN', 'HCF-5.5.2', 'Top',
 '2026-02-01', 'Email',
 'Enrollee', 'ENR-10000', 'Healthcare Facility', 'RES-20000',
 NULL, NULL,
 'New/Acknowledged', NULL, NULL,
 0, NULL, NULL, NULL,
 NULL, NULL,
 NULL, NULL, NULL, 'Enrollee charged as fee-paying patient despite valid NHIA enrolment.',
 'Lagos University Teaching Hospital', 'SERVICOM Seed Batch', NOW(), NOW()),

('CMP-SEED-002', @zn_kan, @st_kan, 2, 2026,
 '2026-02-03', '2026-02-03', 'HMO', 'Fraud', 'HCF-FRD-001',
 'Operational', 'OPS', 'HCF-5.5.4', 'High',
 '2026-02-03', 'Phone',
 'Enrollee', 'ENR-10001', 'HMO', 'RES-20001',
 'Mr. Ibrahim Musa', '2026-02-04',
 'Under Investigation', 'Complaint acknowledged', 'Investigation notes recorded by SERVICOM desk.',
 0, NULL, NULL, NULL,
 NULL, NULL,
 NULL, NULL, NULL, 'Delay in issuance of authorisation code for secondary care referral.',
 'General Hospital Ikeja', 'SERVICOM Seed Batch', NOW(), NOW()),

('CMP-SEED-003', @zn_fct, @st_fct, 2, 2026,
 '2026-02-05', '2026-02-05', 'Enrollee', 'Administrative', 'HCF-ADM-001',
 'Relationship', 'REL', 'HCF-5.5.12', 'Medium',
 '2026-02-05', 'Walk-in',
 'Enrollee', 'ENR-10002', 'Enrollee', 'RES-20002',
 'Mrs. Grace Etim', '2026-02-06',
 'Awaiting Information', 'Complaint acknowledged', 'Investigation notes recorded by SERVICOM desk.',
 0, NULL, NULL, NULL,
 NULL, NULL,
 NULL, NULL, NULL, 'HMO delayed capitation payment to accredited facility.',
 'National Hospital Abuja', 'SERVICOM Seed Batch', NOW(), NOW()),

('CMP-SEED-004', @zn_riv, @st_riv, 2, 2026,
 '2026-02-07', '2026-02-07', 'HCF', 'Access', NULL,
 'Service Delivery', 'SRV', NULL, 'Top',
 '2026-02-07', 'Hotline',
 'Enrollee', 'ENR-10003', 'Healthcare Facility', 'RES-20003',
 'Mr. Chinedu Okeke', '2026-02-08',
 'Escalated', 'Complaint acknowledged', 'Investigation notes recorded by SERVICOM desk.',
 1, 'State Coordinator', '2026-02-12', 'SDO',
 NULL, NULL,
 NULL, NULL, NULL, 'Staff used inappropriate language toward enrollee at registration.',
 'Aminu Kano Teaching Hospital', 'SERVICOM Seed Batch', NOW(), NOW()),

('CMP-SEED-005', @zn_kad, @st_kad, 2, 2026,
 '2026-02-09', '2026-02-09', 'HMO', 'Quality of Care', NULL,
 'Financial', 'FIN', NULL, 'High',
 '2026-02-09', 'Portal',
 'Enrollee', 'ENR-10004', 'HMO', 'RES-20004',
 'Mrs. Fatima Bello', '2026-02-10',
 'Resolved', 'Complaint acknowledged', 'Investigation notes recorded by SERVICOM desk.',
 0, NULL, NULL, NULL,
 8, 1,
 '2026-02-17', 'Resolved', 'Seeded SERVICOM complaint for demo / testing.', 'Facility refused to dispense NHIA drugs and demanded cash payment.',
 'University of Port Harcourt Teaching Hospital', 'SERVICOM Seed Batch', NOW(), NOW()),

('CMP-SEED-006', @zn_imo, @st_imo, 2, 2026,
 '2026-02-11', '2026-02-11', 'Enrollee', 'Communication', NULL,
 'Operational', 'OPS', NULL, 'Medium',
 '2026-02-11', 'Letter',
 'Enrollee', 'ENR-10005', 'Enrollee', 'RES-20005',
 'Mr. Tunde Adebayo', '2026-02-12',
 'Closed', 'Complaint acknowledged', 'Investigation notes recorded by SERVICOM desk.',
 0, NULL, NULL, NULL,
 8, 1,
 '2026-02-19', 'Resolved', 'Seeded SERVICOM complaint for demo / testing.', 'Long waiting time at outpatient desk without explanation.',
 'Ahmadu Bello University Teaching Hospital', 'SERVICOM Seed Batch', NOW(), NOW()),

('CMP-SEED-007', @zn_ond, @st_ond, 2, 2026,
 '2026-02-13', '2026-02-13', 'HCF', 'Referral', NULL,
 'Relationship', 'REL', NULL, 'Top',
 '2026-02-13', 'Email',
 'Enrollee', 'ENR-10006', 'Healthcare Facility', 'RES-20006',
 'Mrs. Ngozi Eze', '2026-02-14',
 'Complaint Withdrawn', 'Complaint acknowledged', 'Investigation notes recorded by SERVICOM desk.',
 0, NULL, NULL, NULL,
 8, 0,
 '2026-02-21', 'Resolved', 'Seeded SERVICOM complaint for demo / testing.', 'Enrollee denied emergency care despite valid NHIA card.',
 'Federal Medical Centre Owerri', 'SERVICOM Seed Batch', NOW(), NOW()),

('CMP-SEED-008', @zn_ben, @st_ben, 2, 2026,
 '2026-02-15', '2026-02-15', 'HMO', 'Abuse', NULL,
 'Service Delivery', 'SRV', NULL, 'High',
 '2026-02-15', 'Phone',
 'Enrollee', 'ENR-10007', 'HMO', 'RES-20007',
 NULL, NULL,
 'New/Acknowledged', NULL, NULL,
 0, NULL, NULL, NULL,
 NULL, NULL,
 NULL, NULL, NULL, 'Incorrect billing for co-payment beyond approved NHIA rates.',
 'Federal Medical Centre Lokoja', 'SERVICOM Seed Batch', NOW(), NOW()),

('CMP-SEED-009', @zn_oyo, @st_oyo, 2, 2026,
 '2026-02-17', '2026-02-17', 'Enrollee', 'Staffing & Resources', NULL,
 'Financial', 'FIN', NULL, 'Medium',
 '2026-02-17', 'Walk-in',
 'Enrollee', 'ENR-10008', 'Enrollee', 'RES-20008',
 'Mrs. Blessing Okoro', '2026-02-18',
 'Under Investigation', 'Complaint acknowledged', 'Investigation notes recorded by SERVICOM desk.',
 0, NULL, NULL, NULL,
 NULL, NULL,
 NULL, NULL, NULL, 'Failure to display NHIA drug list at pharmacy service point.',
 'Lagos State University Teaching Hospital', 'SERVICOM Seed Batch', NOW(), NOW()),

('CMP-SEED-010', @zn_enugu, @st_enugu, 2, 2026,
 '2026-02-19', '2026-02-19', 'HCF', 'Billing', 'HCF-BILL-001',
 'Operational', 'OPS', 'HCF-5.5.2', 'Top',
 '2026-02-19', 'Hotline',
 'Enrollee', 'ENR-10009', 'Healthcare Facility', 'RES-20009',
 'Mr. Ahmed Sani', '2026-02-20',
 'Awaiting Information', 'Complaint acknowledged', 'Investigation notes recorded by SERVICOM desk.',
 0, NULL, NULL, NULL,
 NULL, NULL,
 NULL, NULL, NULL, 'Delay in claims processing affecting facility cashflow.',
 'Gwarinpa General Hospital', 'SERVICOM Seed Batch', NOW(), NOW()),

('CMP-SEED-011', @zn_lag, @st_lag, 2, 2026,
 '2026-02-21', '2026-02-21', 'HMO', 'Fraud', 'HCF-FRD-001',
 'Relationship', 'REL', 'HCF-5.5.4', 'High',
 '2026-02-21', 'Portal',
 'Enrollee', 'ENR-10010', 'HMO', 'RES-20010',
 'Mrs. Ada Okafor', '2026-02-22',
 'Escalated', 'Complaint acknowledged', 'Investigation notes recorded by SERVICOM desk.',
 1, 'State Coordinator', '2026-02-26', 'SDO',
 NULL, NULL,
 NULL, NULL, NULL, 'Poor communication of referral pathways to enrollees.',
 'Murtala Muhammed Specialist Hospital', 'SERVICOM Seed Batch', NOW(), NOW()),

('CMP-SEED-012', @zn_kan, @st_kan, 2, 2026,
 '2026-02-23', '2026-02-23', 'Enrollee', 'Administrative', 'HCF-ADM-001',
 'Service Delivery', 'SRV', 'HCF-5.5.12', 'Medium',
 '2026-02-23', 'Letter',
 'Enrollee', 'ENR-10011', 'Enrollee', 'RES-20011',
 'Mr. Ibrahim Musa', '2026-02-24',
 'Resolved', 'Complaint acknowledged', 'Investigation notes recorded by SERVICOM desk.',
 0, NULL, NULL, NULL,
 8, 1,
 '2026-03-03', 'Resolved', 'Seeded SERVICOM complaint for demo / testing.', 'Facility closed NHIA desk during official working hours.',
 'Braithwaite Memorial Specialist Hospital', 'SERVICOM Seed Batch', NOW(), NOW()),

('CMP-SEED-013', @zn_fct, @st_fct, 2, 2026,
 '2026-02-25', '2026-02-25', 'HCF', 'Access', NULL,
 'Financial', 'FIN', NULL, 'Top',
 '2026-02-25', 'Email',
 'Enrollee', 'ENR-10012', 'Healthcare Facility', 'RES-20012',
 'Mrs. Grace Etim', '2026-02-26',
 'Closed', 'Complaint acknowledged', 'Investigation notes recorded by SERVICOM desk.',
 0, NULL, NULL, NULL,
 8, 0,
 '2026-03-05', 'Resolved', 'Seeded SERVICOM complaint for demo / testing.', 'HMO failed to respond to complaint within stipulated timeline.',
 'Barau Dikko Teaching Hospital', 'SERVICOM Seed Batch', NOW(), NOW()),

('CMP-SEED-014', @zn_riv, @st_riv, 2, 2026,
 '2026-02-27', '2026-02-27', 'HMO', 'Quality of Care', NULL,
 'Operational', 'OPS', NULL, 'High',
 '2026-02-27', 'Phone',
 'Enrollee', 'ENR-10013', 'HMO', 'RES-20013',
 'Mr. Chinedu Okeke', '2026-02-28',
 'Complaint Withdrawn', 'Complaint acknowledged', 'Investigation notes recorded by SERVICOM desk.',
 0, NULL, NULL, NULL,
 8, 1,
 '2026-03-07', 'Resolved', 'Seeded SERVICOM complaint for demo / testing.', 'Enrollee card verification system unavailable for several days.',
 'Imo State University Teaching Hospital', 'SERVICOM Seed Batch', NOW(), NOW()),

('CMP-SEED-015', @zn_kad, @st_kad, 3, 2026,
 '2026-03-01', '2026-03-01', 'Enrollee', 'Communication', NULL,
 'Relationship', 'REL', NULL, 'Medium',
 '2026-03-01', 'Walk-in',
 'Enrollee', 'ENR-10014', 'Enrollee', 'RES-20014',
 NULL, NULL,
 'New/Acknowledged', NULL, NULL,
 0, NULL, NULL, NULL,
 NULL, NULL,
 NULL, NULL, NULL, 'Alleged solicitation of unofficial payments by facility staff.',
 'Federal Medical Centre Asaba', 'SERVICOM Seed Batch', NOW(), NOW()),

('CMP-SEED-016', @zn_imo, @st_imo, 3, 2026,
 '2026-03-03', '2026-03-03', 'HCF', 'Referral', NULL,
 'Service Delivery', 'SRV', NULL, 'Top',
 '2026-03-03', 'Hotline',
 'Enrollee', 'ENR-10015', 'Healthcare Facility', 'RES-20015',
 'Mr. Tunde Adebayo', '2026-03-04',
 'Under Investigation', 'Complaint acknowledged', 'Investigation notes recorded by SERVICOM desk.',
 0, NULL, NULL, NULL,
 NULL, NULL,
 NULL, NULL, NULL, 'Enrollee charged as fee-paying patient despite valid NHIA enrolment.',
 'University of Nigeria Teaching Hospital', 'SERVICOM Seed Batch', NOW(), NOW()),

('CMP-SEED-017', @zn_ond, @st_ond, 3, 2026,
 '2026-03-05', '2026-03-05', 'HMO', 'Abuse', NULL,
 'Financial', 'FIN', NULL, 'High',
 '2026-03-05', 'Portal',
 'Enrollee', 'ENR-10016', 'HMO', 'RES-20016',
 'Mrs. Ngozi Eze', '2026-03-06',
 'Awaiting Information', 'Complaint acknowledged', 'Investigation notes recorded by SERVICOM desk.',
 0, NULL, NULL, NULL,
 NULL, NULL,
 NULL, NULL, NULL, 'Delay in issuance of authorisation code for secondary care referral.',
 'Jos University Teaching Hospital', 'SERVICOM Seed Batch', NOW(), NOW()),

('CMP-SEED-018', @zn_ben, @st_ben, 3, 2026,
 '2026-03-07', '2026-03-07', 'Enrollee', 'Staffing & Resources', NULL,
 'Operational', 'OPS', NULL, 'Medium',
 '2026-03-07', 'Letter',
 'Enrollee', 'ENR-10017', 'Enrollee', 'RES-20017',
 'Mr. Yusuf Aliyu', '2026-03-08',
 'Escalated', 'Complaint acknowledged', 'Investigation notes recorded by SERVICOM desk.',
 1, 'State Coordinator', '2026-03-12', 'SDO',
 NULL, NULL,
 NULL, NULL, NULL, 'HMO delayed capitation payment to accredited facility.',
 'University of Ilorin Teaching Hospital', 'SERVICOM Seed Batch', NOW(), NOW()),

('CMP-SEED-019', @zn_oyo, @st_oyo, 3, 2026,
 '2026-03-09', '2026-03-09', 'HCF', 'Billing', 'HCF-BILL-001',
 'Relationship', 'REL', 'HCF-5.5.2', 'Top',
 '2026-03-09', 'Email',
 'Enrollee', 'ENR-10018', 'Healthcare Facility', 'RES-20018',
 'Mrs. Blessing Okoro', '2026-03-10',
 'Resolved', 'Complaint acknowledged', 'Investigation notes recorded by SERVICOM desk.',
 0, NULL, NULL, NULL,
 8, 0,
 '2026-03-17', 'Resolved', 'Seeded SERVICOM complaint for demo / testing.', 'Staff used inappropriate language toward enrollee at registration.',
 'Federal Medical Centre Abeokuta', 'SERVICOM Seed Batch', NOW(), NOW()),

('CMP-SEED-020', @zn_enugu, @st_enugu, 3, 2026,
 '2026-03-11', '2026-03-11', 'HMO', 'Fraud', 'HCF-FRD-001',
 'Service Delivery', 'SRV', 'HCF-5.5.4', 'High',
 '2026-03-11', 'Phone',
 'Enrollee', 'ENR-10019', 'HMO', 'RES-20019',
 'Mr. Ahmed Sani', '2026-03-12',
 'Closed', 'Complaint acknowledged', 'Investigation notes recorded by SERVICOM desk.',
 0, NULL, NULL, NULL,
 8, 1,
 '2026-03-19', 'Resolved', 'Seeded SERVICOM complaint for demo / testing.', 'Facility refused to dispense NHIA drugs and demanded cash payment.',
 'Delta State University Teaching Hospital', 'SERVICOM Seed Batch', NOW(), NOW()),

('CMP-SEED-021', @zn_lag, @st_lag, 3, 2026,
 '2026-03-13', '2026-03-13', 'Enrollee', 'Administrative', 'HCF-ADM-001',
 'Financial', 'FIN', 'HCF-5.5.12', 'Medium',
 '2026-03-13', 'Walk-in',
 'Enrollee', 'ENR-10020', 'Enrollee', 'RES-20020',
 'Mrs. Ada Okafor', '2026-03-14',
 'Complaint Withdrawn', 'Complaint acknowledged', 'Investigation notes recorded by SERVICOM desk.',
 0, NULL, NULL, NULL,
 8, 1,
 '2026-03-21', 'Resolved', 'Seeded SERVICOM complaint for demo / testing.', 'Long waiting time at outpatient desk without explanation.',
 'Federal Medical Centre Yola', 'SERVICOM Seed Batch', NOW(), NOW()),

('CMP-SEED-022', @zn_kan, @st_kan, 3, 2026,
 '2026-03-15', '2026-03-15', 'HCF', 'Access', NULL,
 'Operational', 'OPS', NULL, 'Top',
 '2026-03-15', 'Hotline',
 'Enrollee', 'ENR-10021', 'Healthcare Facility', 'RES-20021',
 NULL, NULL,
 'New/Acknowledged', NULL, NULL,
 0, NULL, NULL, NULL,
 NULL, NULL,
 NULL, NULL, NULL, 'Enrollee denied emergency care despite valid NHIA card.',
 'University of Calabar Teaching Hospital', 'SERVICOM Seed Batch', NOW(), NOW()),

('CMP-SEED-023', @zn_fct, @st_fct, 3, 2026,
 '2026-03-17', '2026-03-17', 'HMO', 'Quality of Care', NULL,
 'Relationship', 'REL', NULL, 'High',
 '2026-03-17', 'Portal',
 'Enrollee', 'ENR-10022', 'HMO', 'RES-20022',
 'Mrs. Grace Etim', '2026-03-18',
 'Under Investigation', 'Complaint acknowledged', 'Investigation notes recorded by SERVICOM desk.',
 0, NULL, NULL, NULL,
 NULL, NULL,
 NULL, NULL, NULL, 'Incorrect billing for co-payment beyond approved NHIA rates.',
 'Federal Medical Centre Birnin Kebbi', 'SERVICOM Seed Batch', NOW(), NOW()),

('CMP-SEED-024', @zn_riv, @st_riv, 3, 2026,
 '2026-03-19', '2026-03-19', 'Enrollee', 'Communication', NULL,
 'Service Delivery', 'SRV', NULL, 'Medium',
 '2026-03-19', 'Letter',
 'Enrollee', 'ENR-10023', 'Enrollee', 'RES-20023',
 'Mr. Chinedu Okeke', '2026-03-20',
 'Awaiting Information', 'Complaint acknowledged', 'Investigation notes recorded by SERVICOM desk.',
 0, NULL, NULL, NULL,
 NULL, NULL,
 NULL, NULL, NULL, 'Failure to display NHIA drug list at pharmacy service point.',
 'Specialist Hospital Sokoto', 'SERVICOM Seed Batch', NOW(), NOW()),

('CMP-SEED-025', @zn_kad, @st_kad, 3, 2026,
 '2026-03-21', '2026-03-21', 'HCF', 'Referral', NULL,
 'Financial', 'FIN', NULL, 'Top',
 '2026-03-21', 'Email',
 'Enrollee', 'ENR-10024', 'Healthcare Facility', 'RES-20024',
 'Mrs. Fatima Bello', '2026-03-22',
 'Escalated', 'Complaint acknowledged', 'Investigation notes recorded by SERVICOM desk.',
 1, 'State Coordinator', '2026-03-26', 'SDO',
 NULL, NULL,
 NULL, NULL, NULL, 'Delay in claims processing affecting facility cashflow.',
 'Federal Medical Centre Azare', 'SERVICOM Seed Batch', NOW(), NOW()),

('CMP-SEED-026', @zn_imo, @st_imo, 3, 2026,
 '2026-03-23', '2026-03-23', 'HMO', 'Abuse', NULL,
 'Operational', 'OPS', NULL, 'High',
 '2026-03-23', 'Phone',
 'Enrollee', 'ENR-10025', 'HMO', 'RES-20025',
 'Mr. Tunde Adebayo', '2026-03-24',
 'Resolved', 'Complaint acknowledged', 'Investigation notes recorded by SERVICOM desk.',
 0, NULL, NULL, NULL,
 8, 1,
 '2026-03-31', 'Resolved', 'Seeded SERVICOM complaint for demo / testing.', 'Poor communication of referral pathways to enrollees.',
 'Nnamdi Azikiwe University Teaching Hospital', 'SERVICOM Seed Batch', NOW(), NOW()),

('CMP-SEED-027', @zn_ond, @st_ond, 3, 2026,
 '2026-03-25', '2026-03-25', 'Enrollee', 'Staffing & Resources', NULL,
 'Relationship', 'REL', NULL, 'Medium',
 '2026-03-25', 'Walk-in',
 'Enrollee', 'ENR-10026', 'Enrollee', 'RES-20026',
 'Mrs. Ngozi Eze', '2026-03-26',
 'Closed', 'Complaint acknowledged', 'Investigation notes recorded by SERVICOM desk.',
 0, NULL, NULL, NULL,
 8, 1,
 '2026-04-02', 'Resolved', 'Seeded SERVICOM complaint for demo / testing.', 'Facility closed NHIA desk during official working hours.',
 'Federal Medical Centre Keffi', 'SERVICOM Seed Batch', NOW(), NOW()),

('CMP-SEED-028', @zn_ben, @st_ben, 3, 2026,
 '2026-03-27', '2026-03-27', 'HCF', 'Billing', 'HCF-BILL-001',
 'Service Delivery', 'SRV', 'HCF-5.5.2', 'Top',
 '2026-03-27', 'Hotline',
 'Enrollee', 'ENR-10027', 'Healthcare Facility', 'RES-20027',
 'Mr. Yusuf Aliyu', '2026-03-28',
 'Complaint Withdrawn', 'Complaint acknowledged', 'Investigation notes recorded by SERVICOM desk.',
 0, NULL, NULL, NULL,
 8, 0,
 '2026-04-04', 'Resolved', 'Seeded SERVICOM complaint for demo / testing.', 'HMO failed to respond to complaint within stipulated timeline.',
 'Obafemi Awolowo University Teaching Hospital', 'SERVICOM Seed Batch', NOW(), NOW()),

('CMP-SEED-029', @zn_oyo, @st_oyo, 3, 2026,
 '2026-03-29', '2026-03-29', 'HMO', 'Fraud', 'HCF-FRD-001',
 'Financial', 'FIN', 'HCF-5.5.4', 'High',
 '2026-03-29', 'Portal',
 'Enrollee', 'ENR-10028', 'HMO', 'RES-20028',
 NULL, NULL,
 'New/Acknowledged', NULL, NULL,
 0, NULL, NULL, NULL,
 NULL, NULL,
 NULL, NULL, NULL, 'Enrollee card verification system unavailable for several days.',
 'Federal Medical Centre Jalingo', 'SERVICOM Seed Batch', NOW(), NOW()),

('CMP-SEED-030', @zn_enugu, @st_enugu, 3, 2026,
 '2026-03-31', '2026-03-31', 'Enrollee', 'Administrative', 'HCF-ADM-001',
 'Operational', 'OPS', 'HCF-5.5.12', 'Medium',
 '2026-03-31', 'Letter',
 'Enrollee', 'ENR-10029', 'Enrollee', 'RES-20029',
 'Mr. Ahmed Sani', '2026-04-01',
 'Under Investigation', 'Complaint acknowledged', 'Investigation notes recorded by SERVICOM desk.',
 0, NULL, NULL, NULL,
 NULL, NULL,
 NULL, NULL, NULL, 'Alleged solicitation of unofficial payments by facility staff.',
 'University of Benin Teaching Hospital', 'SERVICOM Seed Batch', NOW(), NOW());


-- =============================================================================
-- SUMMARY
--   Satisfaction surveys : SAT-SEED-001 … SAT-SEED-030
--   Charter / comment    : CCC-SEED-001 … CCC-SEED-030
--   Complaints           : CMP-SEED-001 … CMP-SEED-030
-- =============================================================================
SELECT 'satisfaction' AS dataset, COUNT(*) AS rows_loaded
FROM servicom_satisfaction_surveys WHERE reference_id LIKE 'SAT-SEED-%'
UNION ALL
SELECT 'comment_cards', COUNT(*) FROM servicom_comment_cards WHERE reference_id LIKE 'CCC-SEED-%'
UNION ALL
SELECT 'complaints', COUNT(*) FROM servicom_complaints WHERE complaint_number LIKE 'CMP-SEED-%';
