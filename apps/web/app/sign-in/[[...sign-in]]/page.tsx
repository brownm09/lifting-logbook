import { SignIn } from '@clerk/nextjs';

export default function Page() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '4rem' }}>
      <SignIn />
    </div>
  );
}
