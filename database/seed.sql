-- OPTIONAL sample data so you can see the dashboard working. Run after schema.sql.
INSERT INTO members (full_name, phone, position, jersey_no) VALUES
 ('Kwame Mensah','0241000001','Goalkeeper',1),
 ('Kofi Boateng','0241000002','Defender',4),
 ('Yaw Owusu','0241000003','Midfielder',8),
 ('Ama Serwaa','0241000004','Forward',9);
INSERT INTO activities (title, type, target_amount) VALUES
 ('New season kits','Kit & equipment',2000),
 ('Monthly dues - October','Dues',400);
INSERT INTO contributions (member_id, activity_id, amount, method) VALUES
 (1,1,150,'Mobile money'),(2,1,200,'Cash'),(3,2,50,'Mobile money'),(4,1,300,'Bank transfer');
INSERT INTO matches (opponent, match_date, venue, status, goals_for, goals_against) VALUES
 ('Hearts Juniors', CURRENT_DATE - 7, 'Home ground','Played',2,1),
 ('Eastern Stars', CURRENT_DATE + 5, 'Away','Scheduled',NULL,NULL);
INSERT INTO expenses (title, category, amount) VALUES ('Pitch hire','Pitch hire',120),('Match balls','Equipment',180);
