INSERT INTO clients(company_name,contact_name,email,industry,status)
SELECT 'Example Client '||LPAD(g::text,2,'0'),'Business Sponsor '||g,'sponsor'||g||'@example.invalid',
 (ARRAY['Healthcare operations','Financial services','Industrial services','Education technology','Logistics'])[((g-1)%5)+1],'active'
FROM generate_series(1,15) g WHERE NOT EXISTS(SELECT 1 FROM clients WHERE company_name='Example Client '||LPAD(g::text,2,'0'));

INSERT INTO services(name,description,category,base_price,unit,estimated_hours,deliverables,status)
SELECT 'Transformation Service '||LPAD(g::text,2,'0'),'Domain discovery, governed workflow implementation, verification, and measured handoff.',
 (ARRAY['Discovery','Implementation','Integration','Validation','Enablement'])[((g-1)%5)+1],15000+g*1800,'engagement',80+g*4,
 ARRAY['Approved requirements','Working implementation','Verification evidence','Operator handoff'],'active'
FROM generate_series(1,15) g WHERE NOT EXISTS(SELECT 1 FROM services WHERE name='Transformation Service '||LPAD(g::text,2,'0'));

INSERT INTO proposal_templates(name,type,description,sections,variables,is_default,usage_count,status)
SELECT 'Domain Proposal Template '||LPAD(g::text,2,'0'),'proposal','Evidence-backed proposal with explicit assumptions and human approval.',
 jsonb_build_array('Executive outcome','Source evidence','Scope','Delivery plan','Acceptance criteria','Investment','Controls'),
 jsonb_build_object('client','required','accountableOwner','required','successMetric','required'),g=1,g*2,'active'
FROM generate_series(1,15) g WHERE NOT EXISTS(SELECT 1 FROM proposal_templates WHERE name='Domain Proposal Template '||LPAD(g::text,2,'0'));

INSERT INTO templates(name,type,category,description,content,variables,is_default,usage_count,status)
SELECT 'Governed Delivery Template '||LPAD(g::text,2,'0'),'proposal','domain transformation',
 'Reusable proposal and SOW structure with evidence, acceptance, control, and approval sections.',
 'Executive outcome\nSource evidence\nScope\nDelivery plan\nAcceptance criteria\nInvestment\nControls',
 ARRAY['client','accountableOwner','successMetric'],g=1,g*2,'active'
FROM generate_series(1,15) g WHERE NOT EXISTS(SELECT 1 FROM templates WHERE name='Governed Delivery Template '||LPAD(g::text,2,'0'));

INSERT INTO projects(name,client_id,description,status,priority,start_date,end_date,budget,actual_cost,team_members,tags)
SELECT 'Modernization Program '||LPAD(g::text,2,'0'),c.id,'Controlled implementation program with measurable business outcomes.',
 (ARRAY['planning','active','on_hold','completed'])[((g-1)%4)+1],(ARRAY['medium','high','critical'])[((g-1)%3)+1],CURRENT_DATE-g,CURRENT_DATE+60+g,
 80000+g*6500,12000+g*2100,ARRAY[]::integer[],ARRAY['ai-enabled','human-approved','evidence-backed']
FROM generate_series(1,15) g JOIN LATERAL(SELECT id FROM clients ORDER BY id OFFSET (g-1)%15 LIMIT 1)c ON TRUE
WHERE NOT EXISTS(SELECT 1 FROM projects WHERE name='Modernization Program '||LPAD(g::text,2,'0'));

INSERT INTO proposals(title,client_id,project_id,template_id,status,version,executive_summary,scope_of_work,deliverables,timeline,pricing_summary,terms_conditions,total_amount,valid_until)
SELECT 'Outcome Proposal '||LPAD(g::text,2,'0'),p.client_id,p.id,t.id,(ARRAY['draft','review','sent','accepted'])[((g-1)%4)+1],1,
 'Deliver a measurable domain outcome with accountable human decisions and traceable evidence.',
 'Discovery, workflow configuration, integration boundary, validation, training, and outcome review.',
 'Working product increment; test evidence; operating playbook; acceptance record.','Eight-week phased delivery with weekly evidence reviews.',
 'Fixed implementation fee with separately approved provider consumption.','No autonomous consequential actions; changes require written approval.',
 p.budget,CURRENT_DATE+30
FROM generate_series(1,15) g JOIN LATERAL(SELECT * FROM projects ORDER BY id OFFSET (g-1)%15 LIMIT 1)p ON TRUE
JOIN LATERAL(SELECT id FROM templates ORDER BY id OFFSET (g-1)%15 LIMIT 1)t ON TRUE
WHERE NOT EXISTS(SELECT 1 FROM proposals WHERE title='Outcome Proposal '||LPAD(g::text,2,'0'));

INSERT INTO sows(title,client_id,project_id,proposal_id,template_id,status,version,introduction,objectives,scope,deliverables,timeline,milestones,assumptions,constraints,acceptance_criteria,payment_terms,change_management,governance,total_amount)
SELECT 'Statement of Work '||LPAD(g::text,2,'0'),pr.client_id,pr.project_id,pr.id,pr.template_id,
 (ARRAY['draft','review','approved','active'])[((g-1)%4)+1],1,'This SOW translates the approved proposal into governed delivery commitments.',
 'Reduce cycle time while maintaining quality, evidence integrity, and human accountability.',pr.scope_of_work,pr.deliverables,pr.timeline,
 'Discovery signoff; prototype review; production-readiness decision; outcome validation.','Source access and named reviewers are available.','External providers and production credentials remain explicit dependencies.',
 'All defined scenarios pass; accountable owner approves evidence; rollback is demonstrated.','30% start, 40% validated build, 30% accepted outcome.',
 'Changes require impact analysis and written approval.','Weekly steering review; independent quality approval for release.',pr.total_amount
FROM generate_series(1,15) g JOIN LATERAL(SELECT * FROM proposals ORDER BY id OFFSET (g-1)%15 LIMIT 1)pr ON TRUE
WHERE NOT EXISTS(SELECT 1 FROM sows WHERE title='Statement of Work '||LPAD(g::text,2,'0'));
