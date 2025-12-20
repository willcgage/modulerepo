import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

type ModuleStatus = 'ACTIVE' | 'INACTIVE' | 'DEPRECATED' | 'DEVELOPMENT'
type MainlineType = 'SINGLE' | 'DOUBLE'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const module = await prisma.module.findUnique({
      where: { id: params.id },
    })

    if (!module) {
      return NextResponse.json(
        { error: 'Module not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(module)
  } catch (error) {
    console.error('Error fetching module:', error)
    return NextResponse.json(
      { error: 'Failed to fetch module' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const {
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
    } = body

    const module = await prisma.module.update({
      where: { id: params.id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(numberOfEndplates !== undefined && { numberOfEndplates }),
        ...(numberOfMainlines && { numberOfMainlines }),
        ...(status && { status }),
        ...(category && { category }),
        ...(owner !== undefined && { owner }),
        ...(location !== undefined && { location }),
        ...(documentation !== undefined && { documentation }),
        ...(dependencies !== undefined && { dependencies }),
      },
    })

    return NextResponse.json(module)
  } catch (error: any) {
    console.error('Error updating module:', error)
    
    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Module not found' },
        { status: 404 }
      )
    }

    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'A module with this name already exists' },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to update module' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.module.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ message: 'Module deleted successfully' })
  } catch (error: any) {
    console.error('Error deleting module:', error)
    
    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Module not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to delete module' },
      { status: 500 }
    )
  }
}
