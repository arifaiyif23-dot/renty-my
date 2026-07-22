-- Allow authenticated users to insert their own verification requests
DROP POLICY IF EXISTS "Users can insert own verification requests" ON verification_requests;

CREATE POLICY "Users can insert own verification requests"
ON verification_requests FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);
