export default function Home() {
    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            color: 'white',
            padding: '2rem'
        }}>
            <h1 style={{ fontSize: '3rem', marginBottom: '1rem', fontWeight: 'bold' }}>
                Maa Ilay API
            </h1>
            <p style={{ fontSize: '1.25rem', opacity: 0.9, marginBottom: '2rem' }}>
                Backend service is running
            </p>
            <div style={{
                background: 'rgba(255,255,255,0.1)',
                padding: '1.5rem',
                borderRadius: '12px',
                backdropFilter: 'blur(10px)'
            }}>
                <p style={{ marginBottom: '0.5rem' }}>
                    <strong>Frontend:</strong> http://localhost:5173
                </p>
                <p>
                    <strong>API Docs:</strong> /api/*
                </p>
            </div>
        </div>
    )
}
