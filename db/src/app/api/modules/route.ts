import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

type ModuleStatus = 'ACTIVE' | 'INACTIVE' | 'DEPRECATED' | 'DEVELOPMENT'
type MainlineType = 'SINGLE' | 'DOUBLE'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') as ModuleStatus
    const category = searchParams.get('category') || ''

    const skip = (page - 1) * limit

    const where = {
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { description: { contains: search, mode: 'insensitive' as const } },
          { owner: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
      ...(status && { status }),
      ...(category && { category: { contains: category, mode: 'insensitive' as const } }),
    }

    const [modules, total] = await Promise.all([
      prisma.module.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.module.count({ where }),
    ])

    return NextResponse.json({
      modules,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Error fetching modules:', error)
    return NextResponse.json(
      { error: 'Failed to fetch modules' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      name,
      description,
      numberOfEndplates,
      numberOfMainlines = 'SINGLE',
      status = 'ACTIVE',
      category,
      owner,
      location,
      documentation,
      dependencies = [],
    } = body

    // Validate required fields
    if (!name || numberOfEndplates === undefined || !category) {
      return NextResponse.json(
        { error: 'Name, number of endplates, and category are required' },
        { status: 400 }
      )
    }

    const module = await prisma.module.create({
      data: {
        name,
        description,
        numberOfEndplates,
        numberOfMainlines,
        status,
        category,
        owner,
        location,
        documentation,
        dependencies,
      },
    })

    return NextResponse.json(module, { status: 201 })
  } catch (error: any) {
    console.error('Error creating module:', error)
    
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'A module with this name already exists' },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to create module' },
      { status: 500 }
    )
  }
}
