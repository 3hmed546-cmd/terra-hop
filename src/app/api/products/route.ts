import { NextRequest } from "next/server";
import { GET as publicProductsGet } from "@/app/api/public/products/route";
import { POST as adminProductsPost } from "@/app/api/admin/products/route";

export const GET = publicProductsGet;
export const POST = adminProductsPost;
