/*
  Warnings:

  - A unique constraint covering the columns `[enroll_id,date]` on the table `Attendance` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Attendance" ADD COLUMN     "enroll_id" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_enroll_id_date_key" ON "Attendance"("enroll_id", "date");

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_enroll_id_fkey" FOREIGN KEY ("enroll_id") REFERENCES "Enrollment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
