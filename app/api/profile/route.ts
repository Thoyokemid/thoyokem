import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import bcrypt from 'bcryptjs';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { validate, profileUpdateSchema } from '@/lib/validation';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { id: session.user.id } });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      name: user.name,
      photo_url: user.photoUrl,
      phone: user.phone,
      date_of_birth: user.dateOfBirth,
      address: user.address,
      gender: user.gender,
      emergency_contact_name: user.emergencyContactName,
      emergency_contact_phone: user.emergencyContactPhone,
      bio: user.bio,
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const parsed = validate(profileUpdateSchema, await request.json());
    if (!parsed.success) return parsed.response;
    const data = parsed.data;

    const current = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!current) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    let newPassword: string | undefined;
    // Optional password change — requires current password to be correct.
    if (data.new_password) {
      if (!data.current_password) {
        return NextResponse.json({ error: 'Password saat ini wajib diisi' }, { status: 400 });
      }
      const valid = await bcrypt.compare(data.current_password, current.password);
      if (!valid) {
        return NextResponse.json({ error: 'Password saat ini salah' }, { status: 400 });
      }
      newPassword = await bcrypt.hash(data.new_password, 10);
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        name: data.name != null ? data.name : current.name,
        photoUrl: data.photo_url !== undefined ? data.photo_url : current.photoUrl,
        phone: data.phone !== undefined ? data.phone : current.phone,
        dateOfBirth: data.date_of_birth !== undefined ? data.date_of_birth : current.dateOfBirth,
        address: data.address !== undefined ? data.address : current.address,
        gender: data.gender !== undefined ? data.gender : current.gender,
        emergencyContactName:
          data.emergency_contact_name !== undefined ? data.emergency_contact_name : current.emergencyContactName,
        emergencyContactPhone:
          data.emergency_contact_phone !== undefined ? data.emergency_contact_phone : current.emergencyContactPhone,
        bio: data.bio !== undefined ? data.bio : current.bio,
        ...(newPassword ? { password: newPassword } : {}),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating profile:', error);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}
