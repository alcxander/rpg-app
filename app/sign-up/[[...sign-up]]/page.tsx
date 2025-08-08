import { SignUp } from "@clerk/nextjs";

export default function Page() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-900">
      <SignUp
        afterSignUpUrl="/sign-in"
        signInUrl="/sign-in"
        appearance={{
          elements: { formButtonPrimary: 'bg-purple-600 hover:bg-purple-700' },
        }}
      />
    </div>
  );
}
