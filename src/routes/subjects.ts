import express from "express";
import { and, desc, eq, getTableColumns, ilike, or, sql } from "drizzle-orm";
import { departments, subjects } from "../db/schema";
import { db } from "../db";

const router = express.Router();
//Get all subjects with optional search, filtering and pagination  

router.get('/', async (req, res) => {
    try {

        // const {search, department, page = 1, limit = 10} = req.query

        // const currentPage = Math.max(1, +page);
        // const limitPerPage = Math.max(1, +limit);

        const { search, department } = req.query;
        const rawPage = Array.isArray(req.query.page) ? req.query.page[0] : req.query.page;
        const rawLimit = Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit;
        const currentPage = Number.parseInt(String(rawPage ?? "1"), 10);
        const limitPerPage = Number.parseInt(String(rawLimit ?? "10"), 10);

        if (!Number.isInteger(currentPage) || currentPage < 1 || !Number.isInteger(limitPerPage) || limitPerPage < 1) {
            return res.status(400).json({ error: "page and limit must be positive integers" });
        }

        const offset = (currentPage - 1) * limitPerPage;

        const filterConditions = []
        // if search query exists ,filters by subject name or subject code

        if (search) {
            filterConditions.push(
                or(
                    ilike(subjects.name, `%${search}%`),
                    ilike(subjects.code, `%${search}%`),
                )
            );
        }
        // if department filter exists , match department name
        if (department) {
            const deptPattern = `%${String(department).replace(/[%_]/g,'\\$&')}%`
            filterConditions.push(ilike(departments.name, `%${department}%`));
        }

        //combine all filters using AND if any exist
        const whereClause = filterConditions.length > 0 ? and(...filterConditions) : undefined;

        const countResult = await db
            .select({ count: sql<number>`count(*)` })
            .from(subjects)
            .leftJoin(departments, eq(subjects.departmentId, departments.id))
            .where(whereClause)


        const totalCount = countResult[0]?.count ?? 0;
        const subjectsList = await db
            .select({
                ...getTableColumns(subjects),
                department: { ...getTableColumns(departments) }
            })
            .from(subjects).leftJoin(departments, eq(subjects.departmentId, departments.id))
            .where(whereClause)
            .orderBy(desc(subjects.createdAt))
            .limit(limitPerPage)
            .offset(offset)

        res.status(200).json({
            data: subjectsList,
            pagination: {
                page: currentPage,
                limit: limitPerPage,
                total: totalCount,
                totalPages: Math.ceil(totalCount / limitPerPage),
            }
        });
    } catch (e) {
        console.log(`GET /subjects error:${e} `);
        res.status(500).json({ error: 'Failed to get subjects' });
    }
})


export default router